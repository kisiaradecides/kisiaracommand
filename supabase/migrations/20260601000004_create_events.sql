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

-- Aspirant reads everything
CREATE POLICY "admin_read_all_events" ON public.events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role IN ('aspirant','super_user'))
  );

-- Team leads/assistants read scheduled events for their region OR their own submissions
CREATE POLICY "team_read_region_events" ON public.events
  FOR SELECT USING (
    (status = 'scheduled' AND region_id = (SELECT region_id FROM public.users WHERE auth_id = auth.uid()))
    OR created_by = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

-- Team leads/assistants can submit events for their own region
CREATE POLICY "team_insert_events" ON public.events
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid()
        AND u.role IN ('aspirant','super_user','team_lead','assistant')
    )
    AND region_id = (SELECT region_id FROM public.users WHERE auth_id = auth.uid())
  );

-- Only aspirant/super_user can update (approve/discard)
CREATE POLICY "admin_update_events" ON public.events
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role IN ('aspirant','super_user'))
  );
