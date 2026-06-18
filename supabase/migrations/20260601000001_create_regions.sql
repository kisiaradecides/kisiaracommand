CREATE TABLE IF NOT EXISTS public.regions (
  id           SERIAL PRIMARY KEY,
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

-- RLS
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_read_regions" ON public.regions
  FOR SELECT USING (true);
