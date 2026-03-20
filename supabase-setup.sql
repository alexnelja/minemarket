-- Mining Materials Aggregator Platform — Database Schema
-- Run this in your Supabase SQL Editor

-- 0. Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Create ENUM types
CREATE TYPE user_role AS ENUM ('buyer', 'seller', 'both');
CREATE TYPE kyc_status AS ENUM ('pending', 'verified', 'rejected');
CREATE TYPE commodity_type AS ENUM ('chrome', 'manganese', 'iron_ore', 'coal', 'aggregates');
CREATE TYPE harbour_type AS ENUM ('loading', 'destination', 'both');
CREATE TYPE transport_mode AS ENUM ('road', 'rail', 'combined');
CREATE TYPE listing_status AS ENUM ('active', 'paused', 'sold', 'expired');
CREATE TYPE allocation_mode AS ENUM ('open', 'invite_only');
CREATE TYPE requirement_status AS ENUM ('active', 'matched', 'fulfilled', 'expired');
CREATE TYPE deal_status AS ENUM (
  'interest', 'first_accept', 'negotiation', 'second_accept',
  'escrow_held', 'loading', 'in_transit', 'delivered',
  'escrow_released', 'completed', 'disputed', 'cancelled'
);
CREATE TYPE escrow_status AS ENUM ('pending_deposit', 'held', 'releasing', 'released', 'frozen');
CREATE TYPE currency_type AS ENUM ('USD', 'ZAR', 'EUR');
CREATE TYPE milestone_type AS ENUM ('loaded', 'departed_port', 'in_transit', 'arrived_port', 'customs', 'delivered');
CREATE TYPE doc_type AS ENUM ('bill_of_lading', 'certificate_of_origin', 'weighbridge_ticket', 'lab_report', 'customs_declaration', 'invoice');
CREATE TYPE badge_level AS ENUM ('standard', 'premium');

-- 2. Users table (extends Supabase Auth)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'buyer',
  company_name TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'ZA',
  kyc_status kyc_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Harbours (created before mines since mines reference harbours)
CREATE TABLE harbours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  country TEXT NOT NULL,
  type harbour_type NOT NULL DEFAULT 'loading'
);

-- 4. Mines
CREATE TABLE mines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  country TEXT NOT NULL DEFAULT 'ZA',
  region TEXT NOT NULL,
  commodities commodity_type[] NOT NULL,
  nearest_harbour_id UUID REFERENCES harbours(id),
  owner_id UUID REFERENCES users(id) ON DELETE SET NULL
);

-- 5. Routes (mine to harbour)
CREATE TABLE routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_mine_id UUID NOT NULL REFERENCES mines(id) ON DELETE CASCADE,
  harbour_id UUID NOT NULL REFERENCES harbours(id) ON DELETE CASCADE,
  route_geometry GEOGRAPHY(LINESTRING, 4326),
  distance_km NUMERIC NOT NULL,
  transport_mode transport_mode NOT NULL DEFAULT 'road'
);

-- 6. Listings
CREATE TABLE listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_mine_id UUID NOT NULL REFERENCES mines(id),
  commodity_type commodity_type NOT NULL,
  spec_sheet JSONB NOT NULL DEFAULT '{}',
  volume_tonnes NUMERIC NOT NULL,
  price_per_tonne NUMERIC NOT NULL,
  currency currency_type NOT NULL DEFAULT 'USD',
  incoterms TEXT[] NOT NULL DEFAULT '{"FOB"}',
  loading_port_id UUID NOT NULL REFERENCES harbours(id),
  is_verified BOOLEAN NOT NULL DEFAULT false,
  allocation_mode allocation_mode NOT NULL DEFAULT 'open',
  max_buyers INTEGER,
  preferred_buyer_ids UUID[] DEFAULT '{}',
  status listing_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Requirements
CREATE TABLE requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  commodity_type commodity_type NOT NULL,
  target_spec_range JSONB NOT NULL DEFAULT '{}',
  volume_needed NUMERIC NOT NULL,
  target_price NUMERIC NOT NULL,
  currency currency_type NOT NULL DEFAULT 'USD',
  delivery_port TEXT NOT NULL,
  incoterm TEXT NOT NULL DEFAULT 'FOB',
  status requirement_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Deals
CREATE TABLE deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id),
  requirement_id UUID REFERENCES requirements(id),
  buyer_id UUID NOT NULL REFERENCES users(id),
  seller_id UUID NOT NULL REFERENCES users(id),
  commodity_type commodity_type NOT NULL,
  volume_tonnes NUMERIC NOT NULL,
  agreed_price NUMERIC NOT NULL,
  currency currency_type NOT NULL DEFAULT 'USD',
  fx_rate_locked NUMERIC,
  fx_source_timestamp TIMESTAMPTZ,
  incoterm TEXT NOT NULL,
  spec_tolerances JSONB DEFAULT '{}',
  price_adjustment_rules JSONB DEFAULT '{}',
  escrow_amount NUMERIC,
  escrow_status escrow_status DEFAULT 'pending_deposit',
  status deal_status NOT NULL DEFAULT 'interest',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  second_accept_at TIMESTAMPTZ
);

-- 9. Deal milestones
CREATE TABLE deal_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  milestone_type milestone_type NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  location GEOGRAPHY(POINT, 4326),
  location_name TEXT,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES users(id)
);

-- 10. Deal documents
CREATE TABLE deal_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  doc_type doc_type NOT NULL,
  file_url TEXT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified BOOLEAN NOT NULL DEFAULT false
);

-- 11. Verifications
CREATE TABLE verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  lab_report_url TEXT NOT NULL,
  assay_results JSONB NOT NULL DEFAULT '{}',
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  badge_level badge_level NOT NULL DEFAULT 'standard'
);

-- 12. Ratings
CREATE TABLE ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  rater_id UUID NOT NULL REFERENCES users(id),
  rated_user_id UUID NOT NULL REFERENCES users(id),
  spec_accuracy INTEGER NOT NULL CHECK (spec_accuracy BETWEEN 1 AND 5),
  timeliness INTEGER NOT NULL CHECK (timeliness BETWEEN 1 AND 5),
  communication INTEGER NOT NULL CHECK (communication BETWEEN 1 AND 5),
  documentation INTEGER NOT NULL CHECK (documentation BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(deal_id, rater_id)
);

-- 13. Create indexes
CREATE INDEX idx_listings_commodity ON listings(commodity_type);
CREATE INDEX idx_listings_status ON listings(status);
CREATE INDEX idx_listings_seller ON listings(seller_id);
CREATE INDEX idx_requirements_commodity ON requirements(commodity_type);
CREATE INDEX idx_requirements_buyer ON requirements(buyer_id);
CREATE INDEX idx_deals_buyer ON deals(buyer_id);
CREATE INDEX idx_deals_seller ON deals(seller_id);
CREATE INDEX idx_deals_status ON deals(status);
CREATE INDEX idx_deal_milestones_deal ON deal_milestones(deal_id);
CREATE INDEX idx_mines_location ON mines USING GIST(location);
CREATE INDEX idx_harbours_location ON harbours USING GIST(location);

-- 14. Enable Row Level Security on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE mines ENABLE ROW LEVEL SECURITY;
ALTER TABLE harbours ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

-- 15. RLS Policies
CREATE POLICY "Users can read own profile" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Public read harbours" ON harbours FOR SELECT USING (true);
CREATE POLICY "Public read mines" ON mines FOR SELECT USING (true);
CREATE POLICY "Owner can insert mines" ON mines FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owner can update mines" ON mines FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Public read routes" ON routes FOR SELECT USING (true);
CREATE POLICY "Public read active listings" ON listings FOR SELECT USING (status = 'active' OR seller_id = auth.uid());
CREATE POLICY "Seller can insert listings" ON listings FOR INSERT WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "Seller can update listings" ON listings FOR UPDATE USING (auth.uid() = seller_id);
CREATE POLICY "Public read active requirements" ON requirements FOR SELECT USING (status = 'active' OR buyer_id = auth.uid());
CREATE POLICY "Buyer can insert requirements" ON requirements FOR INSERT WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "Buyer can update requirements" ON requirements FOR UPDATE USING (auth.uid() = buyer_id);
CREATE POLICY "Deal participants can read" ON deals FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
CREATE POLICY "Buyer can create deal" ON deals FOR INSERT WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "Participants can update deal" ON deals FOR UPDATE USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
CREATE POLICY "Deal participants can read milestones" ON deal_milestones FOR SELECT USING (EXISTS (SELECT 1 FROM deals WHERE deals.id = deal_milestones.deal_id AND (deals.buyer_id = auth.uid() OR deals.seller_id = auth.uid())));
CREATE POLICY "Deal participants can create milestones" ON deal_milestones FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM deals WHERE deals.id = deal_milestones.deal_id AND (deals.buyer_id = auth.uid() OR deals.seller_id = auth.uid())));
CREATE POLICY "Deal participants can read documents" ON deal_documents FOR SELECT USING (EXISTS (SELECT 1 FROM deals WHERE deals.id = deal_documents.deal_id AND (deals.buyer_id = auth.uid() OR deals.seller_id = auth.uid())));
CREATE POLICY "Deal participants can upload documents" ON deal_documents FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM deals WHERE deals.id = deal_documents.deal_id AND (deals.buyer_id = auth.uid() OR deals.seller_id = auth.uid())));
CREATE POLICY "Public read verifications" ON verifications FOR SELECT USING (true);
CREATE POLICY "Public read ratings" ON ratings FOR SELECT USING (true);
CREATE POLICY "Rater can create rating" ON ratings FOR INSERT WITH CHECK (auth.uid() = rater_id);
