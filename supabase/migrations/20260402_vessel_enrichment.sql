-- Enrich vessel_positions with static AIS data fields
ALTER TABLE vessel_positions ADD COLUMN IF NOT EXISTS imo TEXT;
ALTER TABLE vessel_positions ADD COLUMN IF NOT EXISTS vessel_type_name TEXT;
ALTER TABLE vessel_positions ADD COLUMN IF NOT EXISTS flag TEXT;
ALTER TABLE vessel_positions ADD COLUMN IF NOT EXISTS length DOUBLE PRECISION;
ALTER TABLE vessel_positions ADD COLUMN IF NOT EXISTS width DOUBLE PRECISION;
ALTER TABLE vessel_positions ADD COLUMN IF NOT EXISTS draught DOUBLE PRECISION;
ALTER TABLE vessel_positions ADD COLUMN IF NOT EXISTS deadweight NUMERIC;

CREATE INDEX IF NOT EXISTS idx_vessel_positions_type ON vessel_positions(ship_type);
