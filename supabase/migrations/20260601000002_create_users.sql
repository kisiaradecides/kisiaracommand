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

-- RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "users_read_own" ON public.users
  FOR SELECT USING (auth.uid() = auth_id);

-- Aspirant and super_user read all users
CREATE POLICY "admin_read_all_users" ON public.users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid()
        AND u.role IN ('aspirant','super_user')
    )
  );

-- Aspirant and super_user can insert users
CREATE POLICY "admin_insert_users" ON public.users
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid()
        AND u.role IN ('aspirant','super_user')
    )
  );

-- Aspirant and super_user can update users
CREATE POLICY "admin_update_users" ON public.users
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid()
        AND u.role IN ('aspirant','super_user')
    )
  );
