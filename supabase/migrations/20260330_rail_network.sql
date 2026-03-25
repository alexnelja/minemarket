-- African rail network tables for MineMarket logistics layer

CREATE TABLE IF NOT EXISTS rail_stations (
  id TEXT PRIMARY KEY,
  name TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  country TEXT,
  infra_type TEXT,
  facility_type TEXT,
  source TEXT DEFAULT 'afts-db',
  last_verified_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rail_segments (
  id TEXT PRIMARY KEY,
  from_station_id TEXT,
  to_station_id TEXT,
  country TEXT,
  length_km DOUBLE PRECISION,
  source TEXT DEFAULT 'afts-db'
);

CREATE INDEX IF NOT EXISTS idx_rail_stations_country ON rail_stations(country);
CREATE INDEX IF NOT EXISTS idx_rail_segments_from ON rail_segments(from_station_id);
CREATE INDEX IF NOT EXISTS idx_rail_segments_to ON rail_segments(to_station_id);

ALTER TABLE rail_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE rail_segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read rail stations" ON rail_stations FOR SELECT USING (true);
CREATE POLICY "Public read rail segments" ON rail_segments FOR SELECT USING (true);
