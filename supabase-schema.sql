-- ============================================================
-- GTFS Tools — Supabase Schema
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. Countries table
CREATE TABLE countries (
  code       TEXT PRIMARY KEY,
  status     TEXT NOT NULL DEFAULT 'NOT STARTED',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Agencies table
CREATE TABLE agencies (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code   TEXT NOT NULL REFERENCES countries(code) ON DELETE CASCADE,
  subdivision    TEXT DEFAULT '',
  city_region    TEXT DEFAULT '',
  agency_name    TEXT NOT NULL,
  modes          TEXT[] DEFAULT '{}',
  has_static     BOOLEAN DEFAULT false,
  static_url     TEXT DEFAULT '',
  has_rt         BOOLEAN DEFAULT false,
  rt_vp_url      TEXT DEFAULT '',
  rt_tu_url      TEXT DEFAULT '',
  rt_sa_url      TEXT DEFAULT '',
  quality        TEXT DEFAULT '',
  status         TEXT DEFAULT 'NOT STARTED',
  notes          TEXT DEFAULT '',
  source         TEXT DEFAULT 'manual',
  mdb_source_id  TEXT DEFAULT '',
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

-- 3. Index for fast country lookups
CREATE INDEX idx_agencies_country ON agencies(country_code);

-- 4. Auto-update updated_at on changes
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER countries_updated_at
  BEFORE UPDATE ON countries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER agencies_updated_at
  BEFORE UPDATE ON agencies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 5. Row Level Security — allow all for anon (shared tool)
ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE agencies  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "countries_all" ON countries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "agencies_all"  ON agencies  FOR ALL USING (true) WITH CHECK (true);

-- 6. Seed countries
INSERT INTO countries (code, status) VALUES
  ('DZ', 'SOURCING'),
  ('BG', 'WORKING'),
  ('CN', 'SOURCING'),
  ('HR', 'NOT STARTED'),
  ('CZ', 'FINISHED FOR NOW'),
  ('DK', 'NOT STARTED'),
  ('EG', 'SOURCING'),
  ('EE', 'NOT STARTED'),
  ('FI', 'WORKING'),
  ('GR', 'SOURCING'),
  ('HK', 'WORKING'),
  ('HU', 'FINISHED FOR NOW'),
  ('IN', 'SOURCING'),
  ('ID', 'SOURCING'),
  ('JP', 'SOURCING'),
  ('LV', 'NOT STARTED'),
  ('LT', 'NOT STARTED'),
  ('MY', 'FINISHED FOR NOW'),
  ('MA', 'SOURCING'),
  ('PL', 'FINISHED FOR NOW'),
  ('RO', 'NOT STARTED'),
  ('RS', 'NOT STARTED'),
  ('SG', 'SOURCING'),
  ('SK', 'NOT STARTED'),
  ('SI', 'NOT STARTED'),
  ('TN', 'SOURCING'),
  ('TR', 'BLOCKED'),
  ('UA', 'FINISHED FOR NOW')
ON CONFLICT (code) DO NOTHING;

-- 7. Seed agencies
INSERT INTO agencies (country_code, city_region, agency_name, modes, has_static, static_url, has_rt, rt_vp_url, rt_tu_url, rt_sa_url, quality, notes, status, source) VALUES
  ('HR', 'Zagreb',       'Zagrebački električni tramvaj (ZET)', ARRAY['Bus','Tram'], true,  'https://zet.hr/gtfs/gtfs.zip',                         true,  '', 'https://zet.hr/gtfs-rt/protobuf', '', '', 'Schedule alt: https://zet.hr/gtfsscheduled/latest', 'NOT STARTED', 'manual'),
  ('HR', 'Zagreb',       'HŽ Passenger Transport',              ARRAY['Rail'],       true,  'https://www.hzpp.hr/GTFS_files.zip',                   false, '', '', '', '', '', 'NOT STARTED', 'manual'),
  ('HR', 'Split',        'Promet Split',                        ARRAY['Bus'],        true,  'https://promet-split.hr/gtfs/gtfs.zip',                false, '', '', '', '', '', 'NOT STARTED', 'manual'),
  ('HR', 'Rijeka',       'Autotrolej',                          ARRAY['Bus'],        true,  'https://autotrolej.hr/gtfs/gtfs.zip',                  false, '', '', '', '', '', 'NOT STARTED', 'manual'),
  ('HR', 'National',     'HŽ Putnički prijevoz',               ARRAY['Rail'],       true,  'https://hzpp.hr/gtfs/gtfs.zip',                        false, '', '', '', '', '', 'NOT STARTED', 'manual'),
  ('HR', 'Grad Šibenik', 'Gradski parking d.o.o.',             ARRAY[]::TEXT[],     true,  'https://www.gradski-parking.hr/upload/stranice/2022/08/2022-08-30/89/gtfs.zip', false, '', '', '', '', '', 'NOT STARTED', 'manual'),
  ('TR', 'National',     '(Turkish transit — blocked)',         ARRAY[]::TEXT[],     false, '',                                                     false, '', '', '', '', 'Expired 2024-12 — files must be downloaded individually as .csv', 'BLOCKED', 'manual')
ON CONFLICT (id) DO NOTHING;
