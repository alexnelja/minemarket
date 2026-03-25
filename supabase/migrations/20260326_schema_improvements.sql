-- Migration: Schema Improvements & Best Practices Hardening
-- Mining Materials Aggregator Platform
-- Generated: 2026-03-25
--
-- This migration is additive only — no columns dropped, no data altered.
-- Safe to run multiple times thanks to IF NOT EXISTS / CREATE OR REPLACE guards.
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query).

-- ============================================================================
-- 1. MISSING updated_at COLUMNS
--    Several tables that users or workflows mutate lack an updated_at timestamp.
--    This is essential for cache invalidation, conflict detection, and audit.
-- ============================================================================

ALTER TABLE users       ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE mines       ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE listings    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE requirements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE deals       ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE harbours    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Auto-set updated_at on every UPDATE via a reusable trigger function.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_users_updated_at') THEN
    CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_mines_updated_at') THEN
    CREATE TRIGGER trg_mines_updated_at BEFORE UPDATE ON mines
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_listings_updated_at') THEN
    CREATE TRIGGER trg_listings_updated_at BEFORE UPDATE ON listings
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_requirements_updated_at') THEN
    CREATE TRIGGER trg_requirements_updated_at BEFORE UPDATE ON requirements
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_deals_updated_at') THEN
    CREATE TRIGGER trg_deals_updated_at BEFORE UPDATE ON deals
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_harbours_updated_at') THEN
    CREATE TRIGGER trg_harbours_updated_at BEFORE UPDATE ON harbours
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;


-- ============================================================================
-- 2. CHECK CONSTRAINTS — prevent invalid business data at the DB level
-- ============================================================================

-- Idempotent CHECK constraints (safe to re-run)
DO $$ BEGIN ALTER TABLE listings ADD CONSTRAINT chk_listings_price_positive CHECK (price_per_tonne > 0); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE listings ADD CONSTRAINT chk_listings_volume_positive CHECK (volume_tonnes > 0); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE requirements ADD CONSTRAINT chk_requirements_price_positive CHECK (target_price > 0); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE requirements ADD CONSTRAINT chk_requirements_volume_positive CHECK (volume_needed > 0); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD CONSTRAINT chk_deals_price_positive CHECK (agreed_price > 0); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD CONSTRAINT chk_deals_volume_positive CHECK (volume_tonnes > 0); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD CONSTRAINT chk_deals_escrow_non_negative CHECK (escrow_amount IS NULL OR escrow_amount >= 0); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD CONSTRAINT chk_deals_fx_rate_positive CHECK (fx_rate_locked IS NULL OR fx_rate_locked > 0); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE routes ADD CONSTRAINT chk_routes_distance_positive CHECK (distance_km > 0); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE listings ADD CONSTRAINT chk_listings_max_buyers_positive CHECK (max_buyers IS NULL OR max_buyers > 0); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD CONSTRAINT chk_deals_different_parties CHECK (buyer_id != seller_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================================
-- 3. MISSING FOREIGN KEY CASCADE / RESTRICT BEHAVIORS
--    Several FKs lack explicit ON DELETE behavior, defaulting to NO ACTION
--    which can leave orphaned references or block legitimate deletes.
-- ============================================================================

-- mines.nearest_harbour_id → should SET NULL if harbour deleted (already nullable)
-- Current: no ON DELETE clause (defaults to NO ACTION). Fix:
-- We cannot ALTER a FK in-place; drop and recreate.

ALTER TABLE mines DROP CONSTRAINT IF EXISTS mines_nearest_harbour_id_fkey;
ALTER TABLE mines
  ADD CONSTRAINT mines_nearest_harbour_id_fkey
  FOREIGN KEY (nearest_harbour_id) REFERENCES harbours(id) ON DELETE SET NULL;

-- listings.source_mine_id → RESTRICT deletion of mines that have listings
ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_source_mine_id_fkey;
ALTER TABLE listings
  ADD CONSTRAINT listings_source_mine_id_fkey
  FOREIGN KEY (source_mine_id) REFERENCES mines(id) ON DELETE RESTRICT;

-- listings.loading_port_id → RESTRICT deletion of harbours that have listings
ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_loading_port_id_fkey;
ALTER TABLE listings
  ADD CONSTRAINT listings_loading_port_id_fkey
  FOREIGN KEY (loading_port_id) REFERENCES harbours(id) ON DELETE RESTRICT;

-- deals.listing_id → RESTRICT (don't delete listings with active deals)
ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_listing_id_fkey;
ALTER TABLE deals
  ADD CONSTRAINT deals_listing_id_fkey
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE RESTRICT;

-- deals.requirement_id → SET NULL (requirement can be deleted, deal survives)
ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_requirement_id_fkey;
ALTER TABLE deals
  ADD CONSTRAINT deals_requirement_id_fkey
  FOREIGN KEY (requirement_id) REFERENCES requirements(id) ON DELETE SET NULL;

-- deals.buyer_id / seller_id → RESTRICT (can't delete user with active deals)
ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_buyer_id_fkey;
ALTER TABLE deals
  ADD CONSTRAINT deals_buyer_id_fkey
  FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_seller_id_fkey;
ALTER TABLE deals
  ADD CONSTRAINT deals_seller_id_fkey
  FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE RESTRICT;

-- ratings.rater_id / rated_user_id → CASCADE (if user deleted, remove their ratings)
ALTER TABLE ratings DROP CONSTRAINT IF EXISTS ratings_rater_id_fkey;
ALTER TABLE ratings
  ADD CONSTRAINT ratings_rater_id_fkey
  FOREIGN KEY (rater_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE ratings DROP CONSTRAINT IF EXISTS ratings_rated_user_id_fkey;
ALTER TABLE ratings
  ADD CONSTRAINT ratings_rated_user_id_fkey
  FOREIGN KEY (rated_user_id) REFERENCES users(id) ON DELETE CASCADE;

-- deal_milestones.created_by → RESTRICT (can't delete user who created milestones)
ALTER TABLE deal_milestones DROP CONSTRAINT IF EXISTS deal_milestones_created_by_fkey;
ALTER TABLE deal_milestones
  ADD CONSTRAINT deal_milestones_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT;

-- deal_documents.uploaded_by → RESTRICT (can't delete user who uploaded docs)
ALTER TABLE deal_documents DROP CONSTRAINT IF EXISTS deal_documents_uploaded_by_fkey;
ALTER TABLE deal_documents
  ADD CONSTRAINT deal_documents_uploaded_by_fkey
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE RESTRICT;


-- ============================================================================
-- 4. MISSING INDEXES — common query patterns that lack index support
-- ============================================================================

-- Deals: lookup by listing (needed when checking deal count on a listing)
CREATE INDEX IF NOT EXISTS idx_deals_listing ON deals(listing_id);

-- Deals: lookup by requirement (matching deals to requirements)
CREATE INDEX IF NOT EXISTS idx_deals_requirement ON deals(requirement_id);

-- Deal documents: lookup by deal
CREATE INDEX IF NOT EXISTS idx_deal_documents_deal ON deal_documents(deal_id);

-- Verifications: lookup by listing
CREATE INDEX IF NOT EXISTS idx_verifications_listing ON verifications(listing_id);

-- Ratings: lookup by rated user (for displaying user reputation)
CREATE INDEX IF NOT EXISTS idx_ratings_rated_user ON ratings(rated_user_id);

-- Ratings: lookup by deal
CREATE INDEX IF NOT EXISTS idx_ratings_deal ON ratings(deal_id);

-- Requirements: filter by status (marketplace browsing)
CREATE INDEX IF NOT EXISTS idx_requirements_status ON requirements(status);

-- Mines: lookup by owner
CREATE INDEX IF NOT EXISTS idx_mines_owner ON mines(owner_id);

-- Routes: lookup by mine and harbour
CREATE INDEX IF NOT EXISTS idx_routes_origin_mine ON routes(origin_mine_id);
CREATE INDEX IF NOT EXISTS idx_routes_harbour ON routes(harbour_id);

-- Listings: composite index for marketplace browsing (commodity + status)
CREATE INDEX IF NOT EXISTS idx_listings_commodity_status ON listings(commodity_type, status);

-- Deals: composite index for dashboard (buyer + status, seller + status)
CREATE INDEX IF NOT EXISTS idx_deals_buyer_status ON deals(buyer_id, status);
CREATE INDEX IF NOT EXISTS idx_deals_seller_status ON deals(seller_id, status);

-- Requirements: composite index for marketplace browsing (commodity + status)
CREATE INDEX IF NOT EXISTS idx_requirements_commodity_status ON requirements(commodity_type, status);

-- Listings: created_at for sorting (most recent first)
CREATE INDEX IF NOT EXISTS idx_listings_created_at ON listings(created_at DESC);

-- Deals: created_at for sorting
CREATE INDEX IF NOT EXISTS idx_deals_created_at ON deals(created_at DESC);

-- Mines: filter by country (SA marketplace use case)
CREATE INDEX IF NOT EXISTS idx_mines_country ON mines(country);

-- Deal milestones: composite for timeline queries (deal + timestamp ordering)
CREATE INDEX IF NOT EXISTS idx_deal_milestones_deal_ts ON deal_milestones(deal_id, "timestamp" DESC);


-- ============================================================================
-- 5. MISSING UNIQUE CONSTRAINTS
-- ============================================================================

-- Routes: a mine-harbour-transport combination should be unique
-- (prevents duplicate route entries for the same path & mode)
CREATE UNIQUE INDEX IF NOT EXISTS uq_routes_mine_harbour_mode
  ON routes(origin_mine_id, harbour_id, transport_mode);

-- Verifications: one verification per listing (latest replaces, but enforce uniqueness)
-- NOTE: If multiple verifications per listing are intended, remove this.
-- For now, assuming one active verification per listing.
CREATE UNIQUE INDEX IF NOT EXISTS uq_verifications_listing
  ON verifications(listing_id);

-- Deal documents: prevent duplicate uploads of same doc type per deal
-- (upload a new version by deleting old one first)
CREATE UNIQUE INDEX IF NOT EXISTS uq_deal_documents_deal_type
  ON deal_documents(deal_id, doc_type);

-- Harbours: name + country should be unique (same port name may exist in different countries)
CREATE UNIQUE INDEX IF NOT EXISTS uq_harbours_name_country
  ON harbours(name, country);

-- Mines: name + owner should be unique (same owner can't have two mines with same name)
CREATE UNIQUE INDEX IF NOT EXISTS uq_mines_name_owner
  ON mines(name, owner_id);


-- ============================================================================
-- 6. RLS POLICY GAPS
-- ============================================================================

-- 6a. Ratings: missing UPDATE policy. Raters should be able to edit their rating.
DROP POLICY IF EXISTS "Rater can update rating" ON ratings;
CREATE POLICY "Rater can update rating" ON ratings
  FOR UPDATE USING (auth.uid() = rater_id);

-- 6b. Ratings: missing DELETE policy. Raters should be able to remove their rating.
DROP POLICY IF EXISTS "Rater can delete rating" ON ratings;
CREATE POLICY "Rater can delete rating" ON ratings
  FOR DELETE USING (auth.uid() = rater_id);

-- 6c. Verifications: missing INSERT/UPDATE/DELETE policies.
--     Only the listing seller (or service role) should be able to manage verifications.
DROP POLICY IF EXISTS "Seller can insert verification" ON verifications;
CREATE POLICY "Seller can insert verification" ON verifications
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = verifications.listing_id
        AND listings.seller_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Seller can update verification" ON verifications;
CREATE POLICY "Seller can update verification" ON verifications
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = verifications.listing_id
        AND listings.seller_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Seller can delete verification" ON verifications;
CREATE POLICY "Seller can delete verification" ON verifications
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = verifications.listing_id
        AND listings.seller_id = auth.uid()
    )
  );

-- 6d. Routes: missing INSERT/UPDATE/DELETE policies.
--     Only mine owners should manage routes from their mines.
DROP POLICY IF EXISTS "Mine owner can insert routes" ON routes;
CREATE POLICY "Mine owner can insert routes" ON routes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM mines
      WHERE mines.id = routes.origin_mine_id
        AND mines.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Mine owner can update routes" ON routes;
CREATE POLICY "Mine owner can update routes" ON routes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM mines
      WHERE mines.id = routes.origin_mine_id
        AND mines.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Mine owner can delete routes" ON routes;
CREATE POLICY "Mine owner can delete routes" ON routes
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM mines
      WHERE mines.id = routes.origin_mine_id
        AND mines.owner_id = auth.uid()
    )
  );

-- 6e. Harbours: missing INSERT/UPDATE/DELETE policies.
--     Harbours are reference data — only service_role should write.
--     No authenticated-user write policies needed; read-only is correct.
--     (If admin users need to manage harbours, add service_role policies separately.)

-- 6f. Deal milestones: missing UPDATE policy for milestone creators.
DROP POLICY IF EXISTS "Creator can update milestones" ON deal_milestones;
CREATE POLICY "Creator can update milestones" ON deal_milestones
  FOR UPDATE USING (auth.uid() = created_by);

-- 6g. Deal documents: missing UPDATE policy for uploaders (e.g. mark as verified).
DROP POLICY IF EXISTS "Uploader can update documents" ON deal_documents;
CREATE POLICY "Uploader can update documents" ON deal_documents
  FOR UPDATE USING (auth.uid() = uploaded_by);

-- 6h. Mines: missing DELETE policy for owner.
DROP POLICY IF EXISTS "Owner can delete mines" ON mines;
CREATE POLICY "Owner can delete mines" ON mines
  FOR DELETE USING (auth.uid() = owner_id);


-- ============================================================================
-- 7. SECURITY NOTE — Hardcoded service_role key in webhook trigger
-- ============================================================================
-- The file migration-deal-notifications-webhook.sql contains a hardcoded
-- service_role JWT in the trigger function body. This key grants full DB access
-- and should NEVER be committed to source control.
--
-- Recommended fix (manual): store the key in a Supabase Vault secret and
-- reference it via vault.decrypted_secrets, or use a Supabase Edge Function
-- with the service_role key configured as an environment variable.
--
-- Example using Vault (run manually, not in this migration):
--   SELECT vault.create_secret('supabase-service-role-key', '<your-key>');
--   Then in the trigger function:
--     SELECT decrypted_secret INTO _key
--       FROM vault.decrypted_secrets
--       WHERE name = 'supabase-service-role-key';


-- ============================================================================
-- 8. DEFAULT VALUES — fill in sensible defaults for columns that lack them
-- ============================================================================

-- deal_milestones.location_name: no default needed (nullable free text, OK)
-- deals.spec_tolerances / price_adjustment_rules already default to '{}'

-- mines.created_at — mines table has no created_at at all
ALTER TABLE mines ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- routes.created_at — routes table has no created_at
ALTER TABLE routes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- harbours.created_at — harbours table has no created_at
ALTER TABLE harbours ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();


-- ============================================================================
-- Done. Summary of changes:
--   - 6 updated_at columns + auto-update triggers
--   - 3 created_at columns for tables that lacked them
--   - 10 CHECK constraints (positive prices, volumes, distances, etc.)
--   - 12 FK cascade/restrict behaviors corrected
--   - 17 new indexes (single-column + composite for common queries)
--   - 5 unique constraints
--   - 10 new RLS policies (ratings UPDATE/DELETE, verifications CRUD,
--     routes CRUD, milestones UPDATE, documents UPDATE, mines DELETE)
--   - Security advisory on hardcoded service_role key
-- ============================================================================
