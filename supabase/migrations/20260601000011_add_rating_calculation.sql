-- Auto-calculate loyalty_rating based on:
--   Task completion rate       (0-30 pts)
--   Messages sent to aspirant  (0-30 pts)
--   News/intelligence posts    (0-20 pts)
--   Tenure (days onboarded)    (0-20 pts)

-- Add column to track whether rating is system-calculated or admin-set
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS rating_mode VARCHAR(10) DEFAULT 'auto'
  CHECK (rating_mode IN ('auto', 'manual'));

-- Core rating calculation function
CREATE OR REPLACE FUNCTION calculate_user_rating(user_uuid UUID)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  task_score      NUMERIC := 0;
  message_score   NUMERIC := 0;
  news_score      NUMERIC := 0;
  tenure_score    NUMERIC := 0;
  total_points    NUMERIC := 0;
  final_rating    INT     := 3;

  total_tasks     INT;
  completed_tasks INT;

  message_count   INT;
  aspirant_id     UUID;

  news_count      INT;
  days_onboarded  INT;
BEGIN
  -- 1. TASK COMPLETION SCORE (0-30 pts)
  --    Full points when all assigned tasks are completed.
  --    New members with no tasks start neutral at 15.
  SELECT
    COUNT(*) FILTER (WHERE status = 'completed'),
    COUNT(*)
  INTO completed_tasks, total_tasks
  FROM public.tasks
  WHERE assigned_to = user_uuid;

  IF total_tasks > 0 THEN
    task_score := (completed_tasks::NUMERIC / total_tasks) * 30;
  ELSE
    task_score := 15;
  END IF;

  -- 2. MESSAGES TO ASPIRANT SCORE (0-30 pts)
  --    Rewards members who regularly communicate with the aspirant.
  --    10+ messages in last 60 days = full points.
  SELECT id INTO aspirant_id
  FROM public.users
  WHERE role = 'aspirant'
  LIMIT 1;

  IF aspirant_id IS NOT NULL THEN
    SELECT COUNT(*)
    INTO message_count
    FROM public.messages
    WHERE sender_id = user_uuid
      AND receiver_id = aspirant_id
      AND created_at >= NOW() - INTERVAL '60 days';

    message_score := LEAST(message_count * 3, 30);
  END IF;

  -- 3. NEWS & INTELLIGENCE POSTS SCORE (0-20 pts)
  --    Rewards members who actively post news and field intelligence.
  --    5+ posts in last 30 days = full points.
  SELECT COUNT(*)
  INTO news_count
  FROM public.news_posts
  WHERE author_id = user_uuid
    AND is_deleted = FALSE
    AND created_at >= NOW() - INTERVAL '30 days';

  news_score := LEAST(news_count * 4, 20);

  -- 4. TENURE SCORE (0-20 pts)
  --    1 point per 10 days onboarded, capped at 20 pts (200+ days).
  SELECT EXTRACT(DAY FROM NOW() - date_onboarded)::INT
  INTO days_onboarded
  FROM public.users
  WHERE id = user_uuid;

  tenure_score := LEAST(COALESCE(days_onboarded, 0) / 10.0, 20);

  -- MAP TOTAL (0-100) TO RATING (1-5)
  total_points := task_score + message_score + news_score + tenure_score;

  final_rating := CASE
    WHEN total_points <= 20 THEN 1
    WHEN total_points <= 40 THEN 2
    WHEN total_points <= 60 THEN 3
    WHEN total_points <= 80 THEN 4
    ELSE 5
  END;

  RETURN final_rating;
END;
$$;

-- Batch recalculate all auto-mode users
CREATE OR REPLACE FUNCTION update_all_user_ratings()
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  updated_count INT;
BEGIN
  UPDATE public.users
  SET loyalty_rating = calculate_user_rating(id)
  WHERE rating_mode = 'auto'
    AND role NOT IN ('aspirant', 'super_user');

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- Trigger: recalculate when a task is completed or reassigned
CREATE OR REPLACE FUNCTION trigger_update_assignee_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF (TG_OP = 'INSERT')
     OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed')
     OR (TG_OP = 'UPDATE' AND OLD.assigned_to IS DISTINCT FROM NEW.assigned_to)
  THEN
    IF NEW.assigned_to IS NOT NULL THEN
      UPDATE public.users
      SET loyalty_rating = calculate_user_rating(NEW.assigned_to)
      WHERE id = NEW.assigned_to AND rating_mode = 'auto';
    END IF;

    -- Re-rate previous assignee when a task is reassigned
    IF TG_OP = 'UPDATE' AND OLD.assigned_to IS NOT NULL AND OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
      UPDATE public.users
      SET loyalty_rating = calculate_user_rating(OLD.assigned_to)
      WHERE id = OLD.assigned_to AND rating_mode = 'auto';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER task_update_rating
AFTER INSERT OR UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION trigger_update_assignee_rating();

-- Trigger: recalculate when a message is sent to the aspirant
CREATE OR REPLACE FUNCTION trigger_update_sender_rating_message()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only recalculate if the receiver is the aspirant
  IF EXISTS (SELECT 1 FROM public.users WHERE id = NEW.receiver_id AND role = 'aspirant') THEN
    UPDATE public.users
    SET loyalty_rating = calculate_user_rating(NEW.sender_id)
    WHERE id = NEW.sender_id AND rating_mode = 'auto';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER message_update_rating
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION trigger_update_sender_rating_message();

-- Trigger: recalculate when a news post is created or deleted
CREATE OR REPLACE FUNCTION trigger_update_author_rating_news()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.users
  SET loyalty_rating = calculate_user_rating(
    CASE WHEN TG_OP = 'DELETE' THEN OLD.author_id ELSE NEW.author_id END
  )
  WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.author_id ELSE NEW.author_id END
    AND rating_mode = 'auto';

  RETURN NEW;
END;
$$;

CREATE TRIGGER news_post_update_rating
AFTER INSERT OR UPDATE ON public.news_posts
FOR EACH ROW
EXECUTE FUNCTION trigger_update_author_rating_news();

-- Run initial calculation for all existing auto-mode users
UPDATE public.users
SET loyalty_rating = calculate_user_rating(id)
WHERE rating_mode = 'auto'
  AND role NOT IN ('aspirant', 'super_user');

COMMENT ON COLUMN public.users.rating_mode IS 'auto = system-calculated, manual = admin-set';
COMMENT ON FUNCTION calculate_user_rating IS 'Returns 1-5 loyalty rating: task completion (30) + messages to aspirant (30) + news posts (20) + tenure (20)';
