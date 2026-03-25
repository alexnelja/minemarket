-- Expand commodity_type ENUM with 5 new SA minerals
ALTER TYPE commodity_type ADD VALUE IF NOT EXISTS 'platinum';
ALTER TYPE commodity_type ADD VALUE IF NOT EXISTS 'gold';
ALTER TYPE commodity_type ADD VALUE IF NOT EXISTS 'copper';
ALTER TYPE commodity_type ADD VALUE IF NOT EXISTS 'vanadium';
ALTER TYPE commodity_type ADD VALUE IF NOT EXISTS 'titanium';

-- Add new document types
ALTER TYPE doc_type ADD VALUE IF NOT EXISTS 'lbma_certificate';
ALTER TYPE doc_type ADD VALUE IF NOT EXISTS 'lme_warrant';
ALTER TYPE doc_type ADD VALUE IF NOT EXISTS 'assay_certificate';
ALTER TYPE doc_type ADD VALUE IF NOT EXISTS 'draft_survey';
ALTER TYPE doc_type ADD VALUE IF NOT EXISTS 'phytosanitary_certificate';

-- Add pricing_unit to listings table
ALTER TABLE listings ADD COLUMN IF NOT EXISTS pricing_unit TEXT DEFAULT 'per_tonne';
