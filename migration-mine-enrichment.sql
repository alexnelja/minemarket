-- Migration: Add FINEPRINT enrichment columns to mines
-- Source: FINEPRINT global mining database (https://www.fineprint.global/)

ALTER TABLE mines ADD COLUMN IF NOT EXISTS annual_production_tonnes NUMERIC;
ALTER TABLE mines ADD COLUMN IF NOT EXISTS production_year INTEGER;
ALTER TABLE mines ADD COLUMN IF NOT EXISTS reserves_tonnes NUMERIC;
ALTER TABLE mines ADD COLUMN IF NOT EXISTS capacity_tpa NUMERIC;
ALTER TABLE mines ADD COLUMN IF NOT EXISTS operators TEXT[];
ALTER TABLE mines ADD COLUMN IF NOT EXISTS owners TEXT[];
ALTER TABLE mines ADD COLUMN IF NOT EXISTS transport_mode_to_port TEXT;
ALTER TABLE mines ADD COLUMN IF NOT EXISTS export_destination TEXT;
