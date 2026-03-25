-- Vessel positions from AIS data
CREATE TABLE IF NOT EXISTS vessel_positions (
  mmsi TEXT PRIMARY KEY,
  name TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  speed DOUBLE PRECISION,
  course DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  ship_type INTEGER,
  destination TEXT,
  eta TEXT,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  nearest_harbour_id UUID REFERENCES harbours(id),
  source TEXT DEFAULT 'aisstream'
);

CREATE INDEX IF NOT EXISTS idx_vessel_positions_last_seen ON vessel_positions(last_seen);
CREATE INDEX IF NOT EXISTS idx_vessel_positions_nearest_harbour ON vessel_positions(nearest_harbour_id);

-- Port congestion metrics (updated periodically)
CREATE TABLE IF NOT EXISTS port_congestion (
  harbour_id UUID PRIMARY KEY REFERENCES harbours(id),
  vessels_at_port INTEGER DEFAULT 0,
  vessels_anchored INTEGER DEFAULT 0,
  vessels_approaching INTEGER DEFAULT 0,
  avg_wait_hours DOUBLE PRECISION,
  congestion_level TEXT DEFAULT 'low',
  last_calculated TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT DEFAULT 'aisstream'
);

-- RLS: public read for both tables
ALTER TABLE vessel_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE port_congestion ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read vessel positions" ON vessel_positions FOR SELECT USING (true);
CREATE POLICY "Public read port congestion" ON port_congestion FOR SELECT USING (true);
