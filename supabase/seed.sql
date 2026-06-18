-- ============================================================
-- Kisiara Command — Seed Data
-- Run after all migrations. Safe to re-run (uses ON CONFLICT).
-- ============================================================

-- ── Regions ──────────────────────────────────────────────────
INSERT INTO public.regions (id, name, code, color, total_voters) VALUES
  (1, 'Northwest',  'R1', '#e94560', 1133),
  (2, 'Northeast',  'R2', '#0f3460', 1832),
  (3, 'East',       'R3', '#533483', 2340),
  (4, 'Southeast',  'R4', '#1a936f', 2074),
  (5, 'Southwest',  'R5', '#c17e1a', 5107)
ON CONFLICT (code) DO UPDATE SET
  name         = EXCLUDED.name,
  color        = EXCLUDED.color,
  total_voters = EXCLUDED.total_voters;

-- ── Polling Centres ──────────────────────────────────────────
-- Region 5 — Southwest (6 centres, 10 stations, 5,107 voters)
INSERT INTO public.polling_centres (region_id, name, location, registered_voters, polling_stations) VALUES
  (5, 'Mabasi Primary School',
      ST_SetSRID(ST_MakePoint(35.0728825, -0.5007421), 4326), 1496, 3),
  (5, 'Roret Girls Secondary School',
      ST_SetSRID(ST_MakePoint(35.0991108, -0.5002784), 4326), 1261, 2),
  (5, 'Reresik Primary School',
      ST_SetSRID(ST_MakePoint(35.0900174, -0.4999769), 4326), 993, 2),
  (5, 'Sach Ang''wan Tea Buying Centre',
      ST_SetSRID(ST_MakePoint(35.0852882, -0.4998938), 4326), 895, 2),
  (5, 'Monoru Primary School',
      ST_SetSRID(ST_MakePoint(35.0959294, -0.4974521), 4326), 373, 1),
  (5, 'Ketin Koi Tea Buying Centre',
      ST_SetSRID(ST_MakePoint(35.067783,  -0.507344),  4326), 89,  1)
ON CONFLICT DO NOTHING;

-- Region 3 — East (3 centres, 6 stations, 2,340 voters)
INSERT INTO public.polling_centres (region_id, name, location, registered_voters, polling_stations) VALUES
  (3, 'Tulwet Primary School',
      ST_SetSRID(ST_MakePoint(35.1299723, -0.4892565), 4326), 1435, 3),
  (3, 'Chamamanyik Primary School',
      ST_SetSRID(ST_MakePoint(35.1377074, -0.4844913), 4326), 739, 2),
  (3, 'Kimugul Tea Buying Centre',
      ST_SetSRID(ST_MakePoint(35.137771,  -0.494641),  4326), 166, 1)
ON CONFLICT DO NOTHING;

-- Region 4 — Southeast (3 centres, 5 stations, 2,074 voters)
INSERT INTO public.polling_centres (region_id, name, location, registered_voters, polling_stations) VALUES
  (4, 'Charera Primary School',
      ST_SetSRID(ST_MakePoint(35.1163912, -0.5071347), 4326), 858, 2),
  (4, 'Koituk Primary School',
      ST_SetSRID(ST_MakePoint(35.1366761, -0.5111251), 4326), 839, 2),
  (4, 'Ng''ainet Primary School',
      ST_SetSRID(ST_MakePoint(35.1258466, -0.5013854), 4326), 377, 1)
ON CONFLICT DO NOTHING;

-- Region 2 — Northeast (3 centres, 5 stations, 1,832 voters)
INSERT INTO public.polling_centres (region_id, name, location, registered_voters, polling_stations) VALUES
  (2, 'Keregut Tea Buying Centre',
      ST_SetSRID(ST_MakePoint(35.1090488, -0.476204),  4326), 719, 2),
  (2, 'Kapchelach Primary School',
      ST_SetSRID(ST_MakePoint(35.1177666, -0.4681564), 4326), 569, 1),
  (2, 'Mosore Primary School',
      ST_SetSRID(ST_MakePoint(35.1317772, -0.4681363), 4326), 544, 1)
ON CONFLICT DO NOTHING;

-- Region 1 — Northwest (2 centres, 2 stations, 1,133 voters)
INSERT INTO public.polling_centres (region_id, name, location, registered_voters, polling_stations) VALUES
  (1, 'Roret Primary School',
      ST_SetSRID(ST_MakePoint(35.1038396, -0.4913503), 4326), 611, 1),
  (1, 'Kondamet Tea Buying Centre',
      ST_SetSRID(ST_MakePoint(35.098914,  -0.490037),  4326), 522, 1)
ON CONFLICT DO NOTHING;

-- ── Sample Targets (aspirant can update/delete) ───────────────
-- These are inserted assuming the aspirant user exists.
-- They will be skipped if the aspirant hasn't been provisioned yet.
-- Run after user provisioning.
