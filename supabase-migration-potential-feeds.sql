-- ============================================================
-- Migration: Add potential_feeds table
-- Run this in Supabase SQL Editor AFTER the initial schema
-- ============================================================

CREATE TABLE IF NOT EXISTS potential_feeds (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code   TEXT NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_potential_feeds_country ON potential_feeds(country_code);

CREATE TRIGGER potential_feeds_updated_at
  BEFORE UPDATE ON potential_feeds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE potential_feeds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "potential_feeds_all" ON potential_feeds FOR ALL USING (true) WITH CHECK (true);
