-- Allow listings to be created without a source mine (traders create listings on behalf of mines)
ALTER TABLE listings ALTER COLUMN source_mine_id DROP NOT NULL;
