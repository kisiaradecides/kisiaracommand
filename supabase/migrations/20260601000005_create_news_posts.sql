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

-- All permanent users (non-agent) can read active posts
CREATE POLICY "team_read_active_news" ON public.news_posts
  FOR SELECT USING (
    is_deleted = FALSE
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid()
        AND u.role IN ('aspirant','super_user','team_lead','assistant','opinion_leader')
    )
  );

-- Aspirant can also read deleted posts (for moderation)
CREATE POLICY "admin_read_all_news" ON public.news_posts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role IN ('aspirant','super_user'))
  );

-- Any permanent non-agent user can post
CREATE POLICY "team_insert_news" ON public.news_posts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid()
        AND u.role IN ('aspirant','super_user','team_lead','assistant','opinion_leader')
    )
  );

-- Only aspirant/super_user can soft-delete (update is_deleted)
CREATE POLICY "admin_delete_news" ON public.news_posts
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role IN ('aspirant','super_user'))
  );
