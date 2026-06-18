-- ================================================================
-- KISIARA COMMAND — MASTER MIGRATION
-- Paste this entire file into Supabase SQL Editor and run once.
-- ================================================================

-- ── 0. Extensions ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 1. Regions ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.regions (
  id           SERIAL       PRIMARY KEY,
  name         VARCHAR(50)  NOT NULL,
  code         VARCHAR(10)  NOT NULL UNIQUE,
  color        VARCHAR(7)   NOT NULL,
  boundary     GEOMETRY(POLYGON, 4326),
  area_km2     DECIMAL(10,2),
  total_voters INT          DEFAULT 0,
  created_at   TIMESTAMPTZ  DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_regions_boundary ON public.regions USING GIST(boundary);
CREATE INDEX IF NOT EXISTS idx_regions_code     ON public.regions(code);

ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone_read_regions" ON public.regions;
CREATE POLICY "anyone_read_regions" ON public.regions FOR SELECT USING (true);

-- ── 2. Polling Centres (before users — users FK references it) ─
CREATE TABLE IF NOT EXISTS public.polling_centres (
  id                SERIAL       PRIMARY KEY,
  region_id         INT          NOT NULL REFERENCES public.regions(id),
  name              VARCHAR(150) NOT NULL,
  location          GEOMETRY(POINT, 4326) NOT NULL,
  registered_voters INT          NOT NULL,
  polling_stations  INT          NOT NULL CHECK (polling_stations >= 1),
  created_at        TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_polling_centres_location ON public.polling_centres USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_polling_centres_region   ON public.polling_centres(region_id);

ALTER TABLE public.polling_centres ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_read_centres" ON public.polling_centres;
CREATE POLICY "authenticated_read_centres" ON public.polling_centres
  FOR SELECT USING (auth.role() = 'authenticated');

-- ── 3. Users ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id             UUID         REFERENCES auth.users(id) ON DELETE CASCADE,
  email               VARCHAR(255) UNIQUE NOT NULL,
  role                VARCHAR(20)  NOT NULL CHECK (role IN (
                        'super_user','aspirant','team_lead','assistant','opinion_leader','agent'
                      )),
  region_id           INT          REFERENCES public.regions(id),
  full_name           VARCHAR(100) NOT NULL,
  alt_email           VARCHAR(255),
  phone               VARCHAR(20),
  gender              CHAR(1)      CHECK (gender IN ('M','F')),
  photo_url           TEXT,
  networks            TEXT[],
  estimated_influence INT          DEFAULT 0,
  loyalty_rating      INT          CHECK (loyalty_rating BETWEEN 1 AND 5),
  private_notes       TEXT,
  home_location       GEOMETRY(POINT, 4326),
  polling_station_id  INT          REFERENCES public.polling_centres(id),
  date_onboarded      DATE         DEFAULT CURRENT_DATE,
  is_active           BOOLEAN      DEFAULT TRUE,
  created_at          TIMESTAMPTZ  DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_auth          ON public.users(auth_id);
CREATE INDEX IF NOT EXISTS idx_users_role          ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_region        ON public.users(region_id);
CREATE INDEX IF NOT EXISTS idx_users_email         ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_home_location ON public.users USING GIST(home_location);
CREATE INDEX IF NOT EXISTS idx_users_active        ON public.users(is_active);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_read_own"       ON public.users;
DROP POLICY IF EXISTS "admin_read_all_users" ON public.users;
DROP POLICY IF EXISTS "admin_insert_users"   ON public.users;
DROP POLICY IF EXISTS "admin_update_users"   ON public.users;

CREATE POLICY "users_read_own" ON public.users
  FOR SELECT USING (auth.uid() = auth_id);

CREATE POLICY "admin_read_all_users" ON public.users
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role IN ('aspirant','super_user'))
  );

CREATE POLICY "admin_insert_users" ON public.users
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role IN ('aspirant','super_user'))
  );

CREATE POLICY "admin_update_users" ON public.users
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role IN ('aspirant','super_user'))
  );

-- ── 4. Events ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.events (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  title         VARCHAR(200) NOT NULL,
  description   TEXT,
  event_date    TIMESTAMPTZ  NOT NULL,
  location_text VARCHAR(300),
  location      GEOMETRY(POINT, 4326),
  region_id     INT          NOT NULL REFERENCES public.regions(id),
  created_by    UUID         NOT NULL REFERENCES public.users(id),
  created_role  VARCHAR(20)  NOT NULL,
  status        VARCHAR(20)  NOT NULL DEFAULT 'submitted'
                CHECK (status IN ('submitted','scheduled','discarded')),
  created_at    TIMESTAMPTZ  DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_events_region_status ON public.events(region_id, status);
CREATE INDEX IF NOT EXISTS idx_events_date          ON public.events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_created_by    ON public.events(created_by);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_read_all_events"  ON public.events;
DROP POLICY IF EXISTS "team_read_region_events" ON public.events;
DROP POLICY IF EXISTS "team_insert_events"      ON public.events;
DROP POLICY IF EXISTS "admin_update_events"     ON public.events;

CREATE POLICY "admin_read_all_events" ON public.events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role IN ('aspirant','super_user'))
  );

CREATE POLICY "team_read_region_events" ON public.events
  FOR SELECT USING (
    (status = 'scheduled' AND region_id = (SELECT region_id FROM public.users WHERE auth_id = auth.uid()))
    OR created_by = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

CREATE POLICY "team_insert_events" ON public.events
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role IN ('aspirant','super_user','team_lead','assistant'))
  );

CREATE POLICY "admin_update_events" ON public.events
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role IN ('aspirant','super_user'))
  );

-- ── 5. News Posts ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.news_posts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id   UUID        NOT NULL REFERENCES public.users(id),
  author_role VARCHAR(20) NOT NULL,
  region_id   INT         REFERENCES public.regions(id),
  content     TEXT        NOT NULL,
  is_deleted  BOOLEAN     DEFAULT FALSE,
  deleted_by  UUID        REFERENCES public.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_news_posts_created ON public.news_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_posts_author  ON public.news_posts(author_id);

ALTER TABLE public.news_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "team_read_active_news" ON public.news_posts;
DROP POLICY IF EXISTS "admin_read_all_news"   ON public.news_posts;
DROP POLICY IF EXISTS "team_insert_news"      ON public.news_posts;
DROP POLICY IF EXISTS "admin_delete_news"     ON public.news_posts;

CREATE POLICY "team_read_active_news" ON public.news_posts
  FOR SELECT USING (
    is_deleted = FALSE
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role IN ('aspirant','super_user','team_lead','assistant','opinion_leader'))
  );

CREATE POLICY "admin_read_all_news" ON public.news_posts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role IN ('aspirant','super_user'))
  );

CREATE POLICY "team_insert_news" ON public.news_posts
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role IN ('aspirant','super_user','team_lead','assistant','opinion_leader'))
  );

CREATE POLICY "admin_delete_news" ON public.news_posts
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role IN ('aspirant','super_user'))
  );

-- ── 6. Messages ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id   UUID        NOT NULL REFERENCES public.users(id),
  receiver_id UUID        NOT NULL REFERENCES public.users(id),
  content     TEXT        NOT NULL,
  is_read     BOOLEAN     DEFAULT FALSE,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_participants    ON public.messages(sender_id, receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_unread ON public.messages(receiver_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_messages_created         ON public.messages(created_at);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_read_own_messages"  ON public.messages;
DROP POLICY IF EXISTS "users_insert_own_messages" ON public.messages;
DROP POLICY IF EXISTS "admin_update_messages"    ON public.messages;

CREATE POLICY "users_read_own_messages" ON public.messages
  FOR SELECT USING (
    sender_id   = (SELECT id FROM public.users WHERE auth_id = auth.uid())
    OR receiver_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

CREATE POLICY "users_insert_own_messages" ON public.messages
  FOR INSERT WITH CHECK (
    sender_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

CREATE POLICY "admin_update_messages" ON public.messages
  FOR UPDATE USING (
    receiver_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

-- ── 7. Missions ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.missions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title        VARCHAR(200) NOT NULL,
  description  TEXT,
  deadline     DATE,
  status       VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
  created_by   UUID        NOT NULL REFERENCES public.users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_missions_status   ON public.missions(status);
CREATE INDEX IF NOT EXISTS idx_missions_deadline ON public.missions(deadline);

ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_manage_missions" ON public.missions;
DROP POLICY IF EXISTS "team_read_missions"    ON public.missions;

CREATE POLICY "admin_manage_missions" ON public.missions
  FOR ALL USING (EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role IN ('aspirant','super_user')));

CREATE POLICY "team_read_missions" ON public.missions
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role IN ('aspirant','super_user','team_lead','assistant','opinion_leader')));

-- ── 8. Tasks ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tasks (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id     UUID         REFERENCES public.missions(id) ON DELETE SET NULL,
  title          VARCHAR(200) NOT NULL,
  description    TEXT,
  region_id      INT          REFERENCES public.regions(id),
  assigned_to    UUID         REFERENCES public.users(id),
  priority       VARCHAR(10)  NOT NULL DEFAULT 'medium' CHECK (priority IN ('high','medium','low')),
  status         VARCHAR(20)  NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','under_review','completed')),
  due_date       DATE,
  progress       INT          DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  target_metric  INT,
  current_metric INT          DEFAULT 0,
  created_by     UUID         NOT NULL REFERENCES public.users(id),
  created_at     TIMESTAMPTZ  DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned     ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_region       ON public.tasks(region_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status       ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_mission      ON public.tasks(mission_id);
CREATE INDEX IF NOT EXISTS idx_tasks_priority_due ON public.tasks(priority, due_date);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_all_tasks"          ON public.tasks;
DROP POLICY IF EXISTS "team_read_region_tasks"   ON public.tasks;
DROP POLICY IF EXISTS "users_read_assigned_tasks" ON public.tasks;
DROP POLICY IF EXISTS "assignee_update_own_task" ON public.tasks;

CREATE POLICY "admin_all_tasks" ON public.tasks
  FOR ALL USING (EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role IN ('aspirant','super_user')));

CREATE POLICY "team_read_region_tasks" ON public.tasks
  FOR SELECT USING (
    region_id = (SELECT region_id FROM public.users WHERE auth_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role IN ('team_lead','assistant'))
  );

CREATE POLICY "users_read_assigned_tasks" ON public.tasks
  FOR SELECT USING (assigned_to = (SELECT id FROM public.users WHERE auth_id = auth.uid()));

CREATE POLICY "assignee_update_own_task" ON public.tasks
  FOR UPDATE USING (assigned_to = (SELECT id FROM public.users WHERE auth_id = auth.uid()));

-- ── 9. Task Comments ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.task_comments (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID        NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id  UUID        NOT NULL REFERENCES public.users(id),
  content    TEXT        NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_task_comments_task    ON public.task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_created ON public.task_comments(created_at);

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "task_participants_comments" ON public.task_comments;

CREATE POLICY "task_participants_comments" ON public.task_comments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.tasks t WHERE t.id = task_id AND (
        EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role IN ('aspirant','super_user'))
        OR t.assigned_to = (SELECT id FROM public.users WHERE auth_id = auth.uid())
        OR (t.region_id = (SELECT region_id FROM public.users WHERE auth_id = auth.uid())
            AND EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role IN ('team_lead','assistant')))
      )
    )
  );

-- ── 10. Targets ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.targets (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  title         VARCHAR(200) NOT NULL,
  description   TEXT,
  region_id     INT          REFERENCES public.regions(id),
  target_value  INT          NOT NULL CHECK (target_value > 0),
  current_value INT          DEFAULT 0 CHECK (current_value >= 0),
  unit          VARCHAR(50)  DEFAULT 'count',
  deadline      DATE,
  created_by    UUID         NOT NULL REFERENCES public.users(id),
  created_at    TIMESTAMPTZ  DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_targets_region   ON public.targets(region_id);
CREATE INDEX IF NOT EXISTS idx_targets_deadline ON public.targets(deadline);

ALTER TABLE public.targets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_manage_targets" ON public.targets;

CREATE POLICY "admin_manage_targets" ON public.targets
  FOR ALL USING (EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role IN ('aspirant','super_user')));

-- ── 11. GOTV Reports ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gotv_reports (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id             UUID        NOT NULL REFERENCES public.users(id),
  polling_centre_id    INT         NOT NULL REFERENCES public.polling_centres(id),
  report_type          VARCHAR(30) NOT NULL CHECK (report_type IN ('station_status','turnout','incident')),
  station_status       VARCHAR(20) CHECK (station_status IN ('open','delayed','problem','closed')),
  turnout_count        INT         CHECK (turnout_count >= 0),
  incident_type        VARCHAR(50),
  incident_description TEXT,
  incident_status      VARCHAR(20) DEFAULT 'active' CHECK (incident_status IN ('active','resolved','escalated')),
  created_at           TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gotv_reports_centre ON public.gotv_reports(polling_centre_id);
CREATE INDEX IF NOT EXISTS idx_gotv_reports_type   ON public.gotv_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_gotv_reports_time   ON public.gotv_reports(created_at);
CREATE INDEX IF NOT EXISTS idx_gotv_reports_agent  ON public.gotv_reports(agent_id);

ALTER TABLE public.gotv_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "agent_insert_reports"   ON public.gotv_reports;
DROP POLICY IF EXISTS "admin_read_all_reports" ON public.gotv_reports;

CREATE POLICY "agent_insert_reports" ON public.gotv_reports
  FOR INSERT WITH CHECK (
    agent_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role = 'agent')
  );

CREATE POLICY "admin_read_all_reports" ON public.gotv_reports
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role IN ('aspirant','super_user')));

-- ── 12. GOTV Results ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gotv_results (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id          UUID        NOT NULL REFERENCES public.users(id),
  polling_centre_id INT         NOT NULL REFERENCES public.polling_centres(id) UNIQUE,
  form_photo_url    TEXT,
  registered_voters INT         NOT NULL,
  total_votes_cast  INT         NOT NULL CHECK (total_votes_cast >= 0),
  rejected_votes    INT         NOT NULL DEFAULT 0 CHECK (rejected_votes >= 0),
  candidate_results JSONB       NOT NULL DEFAULT '{}',
  is_verified       BOOLEAN     DEFAULT FALSE,
  verified_by       UUID        REFERENCES public.users(id),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gotv_results_centre   ON public.gotv_results(polling_centre_id);
CREATE INDEX IF NOT EXISTS idx_gotv_results_verified ON public.gotv_results(is_verified);

ALTER TABLE public.gotv_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "agent_insert_results"        ON public.gotv_results;
DROP POLICY IF EXISTS "admin_all_results"           ON public.gotv_results;
DROP POLICY IF EXISTS "public_read_verified_results" ON public.gotv_results;

CREATE POLICY "agent_insert_results" ON public.gotv_results
  FOR INSERT WITH CHECK (
    agent_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role = 'agent')
  );

CREATE POLICY "admin_all_results" ON public.gotv_results
  FOR ALL USING (EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role IN ('aspirant','super_user')));

CREATE POLICY "public_read_verified_results" ON public.gotv_results
  FOR SELECT USING (is_verified = TRUE);

-- ── 13. Activity Log ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.activity_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES public.users(id),
  action      VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id   UUID,
  metadata    JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_activity_log_user    ON public.activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON public.activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity  ON public.activity_log(entity_type, entity_id);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_read_activity"   ON public.activity_log;
DROP POLICY IF EXISTS "system_insert_activity" ON public.activity_log;

CREATE POLICY "admin_read_activity" ON public.activity_log
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role IN ('aspirant','super_user')));

CREATE POLICY "system_insert_activity" ON public.activity_log
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ================================================================
-- SEED DATA — Regions and Polling Centres
-- ================================================================

INSERT INTO public.regions (id, name, code, color, total_voters) VALUES
  (1, 'Northwest', 'R1', '#e94560', 1133),
  (2, 'Northeast', 'R2', '#0f3460', 1832),
  (3, 'East',      'R3', '#533483', 2340),
  (4, 'Southeast', 'R4', '#1a936f', 2074),
  (5, 'Southwest', 'R5', '#c17e1a', 5107)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name, color = EXCLUDED.color, total_voters = EXCLUDED.total_voters;

INSERT INTO public.polling_centres (region_id, name, location, registered_voters, polling_stations) VALUES
  (5, 'Mabasi Primary School',          ST_SetSRID(ST_MakePoint(35.0728825, -0.5007421), 4326), 1496, 3),
  (3, 'Tulwet Primary School',          ST_SetSRID(ST_MakePoint(35.1299723, -0.4892565), 4326), 1435, 3),
  (5, 'Roret Girls Secondary School',   ST_SetSRID(ST_MakePoint(35.0991108, -0.5002784), 4326), 1261, 2),
  (5, 'Reresik Primary School',         ST_SetSRID(ST_MakePoint(35.0900174, -0.4999769), 4326), 993,  2),
  (5, 'Sach Ang''wan Tea Buying Centre',ST_SetSRID(ST_MakePoint(35.0852882, -0.4998938), 4326), 895,  2),
  (4, 'Charera Primary School',         ST_SetSRID(ST_MakePoint(35.1163912, -0.5071347), 4326), 858,  2),
  (4, 'Koituk Primary School',          ST_SetSRID(ST_MakePoint(35.1366761, -0.5111251), 4326), 839,  2),
  (3, 'Chamamanyik Primary School',     ST_SetSRID(ST_MakePoint(35.1377074, -0.4844913), 4326), 739,  2),
  (2, 'Keregut Tea Buying Centre',      ST_SetSRID(ST_MakePoint(35.1090488, -0.476204),  4326), 719,  2),
  (1, 'Roret Primary School',           ST_SetSRID(ST_MakePoint(35.1038396, -0.4913503), 4326), 611,  1),
  (2, 'Kapchelach Primary School',      ST_SetSRID(ST_MakePoint(35.1177666, -0.4681564), 4326), 569,  1),
  (2, 'Mosore Primary School',          ST_SetSRID(ST_MakePoint(35.1317772, -0.4681363), 4326), 544,  1),
  (1, 'Kondamet Tea Buying Centre',     ST_SetSRID(ST_MakePoint(35.098914,  -0.490037),  4326), 522,  1),
  (4, 'Ng''ainet Primary School',       ST_SetSRID(ST_MakePoint(35.1258466, -0.5013854), 4326), 377,  1),
  (5, 'Monoru Primary School',          ST_SetSRID(ST_MakePoint(35.0959294, -0.4974521), 4326), 373,  1),
  (3, 'Kimugul Tea Buying Centre',      ST_SetSRID(ST_MakePoint(35.137771,  -0.494641),  4326), 166,  1),
  (5, 'Ketin Koi Tea Buying Centre',    ST_SetSRID(ST_MakePoint(35.067783,  -0.507344),  4326), 89,   1)
ON CONFLICT DO NOTHING;

-- ================================================================
-- DONE. Next step: create Franklin's auth user in the Supabase
-- Dashboard → Authentication → Users, then run:
--
-- INSERT INTO public.users (auth_id, email, role, full_name)
-- VALUES ('<paste-uuid-here>', 'franklin@kisiara.app', 'aspirant', 'Franklin Kipchirchir');
-- ================================================================
