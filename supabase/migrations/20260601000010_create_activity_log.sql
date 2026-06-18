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

-- Aspirant/super_user can read the full audit trail
CREATE POLICY "admin_read_activity" ON public.activity_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role IN ('aspirant','super_user'))
  );

-- Any authenticated user can insert log entries (the app writes these)
CREATE POLICY "system_insert_activity" ON public.activity_log
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
