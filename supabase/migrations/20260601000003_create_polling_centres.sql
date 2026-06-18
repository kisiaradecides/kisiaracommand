CREATE TABLE IF NOT EXISTS public.polling_centres (
  id                 SERIAL       PRIMARY KEY,
  region_id          INT          NOT NULL REFERENCES public.regions(id),
  name               VARCHAR(150) NOT NULL,
  location           GEOMETRY(POINT, 4326) NOT NULL,
  registered_voters  INT          NOT NULL,
  polling_stations   INT          NOT NULL CHECK (polling_stations >= 1),
  created_at         TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_polling_centres_location ON public.polling_centres USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_polling_centres_region   ON public.polling_centres(region_id);

-- RLS: all authenticated users can read; no inserts via API (seeded only)
ALTER TABLE public.polling_centres ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_centres" ON public.polling_centres
  FOR SELECT USING (auth.role() = 'authenticated');
