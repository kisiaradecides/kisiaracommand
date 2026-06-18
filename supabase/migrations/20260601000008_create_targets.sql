CREATE TABLE IF NOT EXISTS public.targets (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title         VARCHAR(200) NOT NULL,
  description   TEXT,
  region_id     INT         REFERENCES public.regions(id),
  target_value  INT         NOT NULL CHECK (target_value > 0),
  current_value INT         DEFAULT 0 CHECK (current_value >= 0),
  unit          VARCHAR(50) DEFAULT 'count',
  deadline      DATE,
  created_by    UUID        NOT NULL REFERENCES public.users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_targets_region   ON public.targets(region_id);
CREATE INDEX IF NOT EXISTS idx_targets_deadline ON public.targets(deadline);

ALTER TABLE public.targets ENABLE ROW LEVEL SECURITY;

-- Aspirant/super_user full access
CREATE POLICY "admin_manage_targets" ON public.targets
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role IN ('aspirant','super_user'))
  );
