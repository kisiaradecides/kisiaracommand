-- GOTV Reports (station status, turnout, incidents)
CREATE TABLE IF NOT EXISTS public.gotv_reports (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id             UUID        NOT NULL REFERENCES public.users(id),
  polling_centre_id    INT         NOT NULL REFERENCES public.polling_centres(id),
  report_type          VARCHAR(30) NOT NULL
                       CHECK (report_type IN ('station_status','turnout','incident')),
  station_status       VARCHAR(20)
                       CHECK (station_status IN ('open','delayed','problem','closed')),
  turnout_count        INT         CHECK (turnout_count >= 0),
  incident_type        VARCHAR(50),
  incident_description TEXT,
  incident_status      VARCHAR(20) DEFAULT 'active'
                       CHECK (incident_status IN ('active','resolved','escalated')),
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gotv_reports_centre ON public.gotv_reports(polling_centre_id);
CREATE INDEX IF NOT EXISTS idx_gotv_reports_type   ON public.gotv_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_gotv_reports_time   ON public.gotv_reports(created_at);
CREATE INDEX IF NOT EXISTS idx_gotv_reports_agent  ON public.gotv_reports(agent_id);

ALTER TABLE public.gotv_reports ENABLE ROW LEVEL SECURITY;

-- Agents insert their own reports
CREATE POLICY "agent_insert_reports" ON public.gotv_reports
  FOR INSERT WITH CHECK (
    agent_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role = 'agent'
    )
  );

-- Aspirant/super_user read all reports
CREATE POLICY "admin_read_all_reports" ON public.gotv_reports
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role IN ('aspirant','super_user'))
  );

-- GOTV Results (official Form 35A data)
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

-- Agents can insert their station result (UNIQUE constraint prevents duplicates)
CREATE POLICY "agent_insert_results" ON public.gotv_results
  FOR INSERT WITH CHECK (
    agent_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role = 'agent'
    )
  );

-- Aspirant/super_user full access
CREATE POLICY "admin_all_results" ON public.gotv_results
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role IN ('aspirant','super_user'))
  );

-- Public can read verified results (no auth required)
CREATE POLICY "public_read_verified_results" ON public.gotv_results
  FOR SELECT USING (is_verified = TRUE);
