// Core enums as TypeScript types
export type UserRole = 'buyer' | 'seller' | 'both';
export type KycStatus = 'pending' | 'verified' | 'rejected';
export type CommodityType = 'chrome' | 'manganese' | 'iron_ore' | 'coal' | 'aggregates' | 'platinum' | 'gold' | 'copper' | 'vanadium' | 'titanium';
export type HarbourType = 'loading' | 'destination' | 'both';
export type TransportMode = 'road' | 'rail' | 'combined';
export type ListingStatus = 'active' | 'paused' | 'sold' | 'expired';
export type AllocationMode = 'open' | 'invite_only';
export type RequirementStatus = 'active' | 'matched' | 'fulfilled' | 'expired';
export type DealStatus =
  | 'interest' | 'first_accept' | 'negotiation' | 'second_accept'
  | 'escrow_held' | 'loading' | 'in_transit' | 'delivered'
  | 'escrow_released' | 'completed' | 'disputed' | 'cancelled';
export type EscrowStatus = 'pending_deposit' | 'held' | 'releasing' | 'released' | 'frozen';
export type CurrencyType = 'USD' | 'ZAR' | 'EUR';
export type MilestoneType = 'loaded' | 'departed_port' | 'in_transit' | 'arrived_port' | 'customs' | 'delivered';
export type DocType = 'bill_of_lading' | 'certificate_of_origin' | 'weighbridge_ticket' | 'lab_report' | 'customs_declaration' | 'invoice' | 'lbma_certificate' | 'lme_warrant' | 'assay_certificate' | 'draft_survey' | 'phytosanitary_certificate';
export type BadgeLevel = 'standard' | 'premium';

// Database row types
export interface User {
  id: string;
  role: UserRole;
  company_name: string;
  country: string;
  kyc_status: KycStatus;
  created_at: string;
}

export interface Harbour {
  id: string;
  name: string;
  location: unknown;
  country: string;
  type: HarbourType;
}

export interface Mine {
  id: string;
  name: string;
  location: unknown;
  country: string;
  region: string;
  commodities: CommodityType[];
  nearest_harbour_id: string;
  owner_id: string | null;
}

export interface Route {
  id: string;
  origin_mine_id: string;
  harbour_id: string;
  route_geometry: unknown;
  distance_km: number;
  transport_mode: TransportMode;
}

export interface Listing {
  id: string;
  seller_id: string;
  source_mine_id: string | null;
  commodity_type: CommodityType;
  commodity_subtype: string | null;
  spec_sheet: Record<string, number>;
  volume_tonnes: number;
  price_per_tonne: number;
  currency: CurrencyType;
  incoterms: string[];
  loading_port_id: string;
  is_verified: boolean;
  allocation_mode: AllocationMode;
  max_buyers: number | null;
  preferred_buyer_ids: string[];
  status: ListingStatus;
  price_confidence: string | null;
  price_breakdown: Record<string, unknown>[] | null;
  created_at: string;
}

export interface Requirement {
  id: string;
  buyer_id: string;
  commodity_type: CommodityType;
  target_spec_range: Record<string, { min?: number; max?: number }>;
  volume_needed: number;
  target_price: number;
  currency: CurrencyType;
  delivery_port: string;
  incoterm: string;
  status: RequirementStatus;
  created_at: string;
}

export interface Deal {
  id: string;
  listing_id: string;
  requirement_id: string | null;
  buyer_id: string;
  seller_id: string;
  commodity_type: CommodityType;
  volume_tonnes: number;
  agreed_price: number;
  currency: CurrencyType;
  fx_rate_locked: number | null;
  fx_source_timestamp: string | null;
  incoterm: string;
  spec_tolerances: Record<string, unknown>;
  price_adjustment_rules: Record<string, unknown>;
  escrow_amount: number | null;
  escrow_status: EscrowStatus;
  status: DealStatus;
  created_at: string;
  second_accept_at: string | null;
}

export interface DealMilestone {
  id: string;
  deal_id: string;
  milestone_type: MilestoneType;
  timestamp: string;
  location: unknown;
  location_name: string | null;
  notes: string | null;
  created_by: string;
}

export interface DealDocument {
  id: string;
  deal_id: string;
  doc_type: DocType;
  file_url: string;
  uploaded_by: string;
  uploaded_at: string;
  verified: boolean;
}

export interface Verification {
  id: string;
  listing_id: string;
  lab_report_url: string;
  assay_results: Record<string, number>;
  verified_at: string;
  badge_level: BadgeLevel;
}

export interface Rating {
  id: string;
  deal_id: string;
  rater_id: string;
  rated_user_id: string;
  spec_accuracy: number;
  timeliness: number;
  communication: number;
  documentation: number;
  comment: string | null;
  created_at: string;
}

// GeoJSON point extracted from PostGIS geography columns
export interface GeoPoint {
  lng: number;
  lat: number;
}

// Extended types with parsed geography for client use
export interface MineWithGeo extends Omit<Mine, 'location'> {
  location: GeoPoint;
}

export interface HarbourWithGeo extends Omit<Harbour, 'location'> {
  location: GeoPoint;
}

// Listing joined with mine and harbour names for display
export interface ListingWithDetails extends Listing {
  mine_name: string;
  mine_region: string;
  mine_location: GeoPoint;
  harbour_name: string;
  harbour_location: GeoPoint;
  seller_company: string;
}

export const COMMODITY_CONFIG: Record<CommodityType, { label: string; color: string }> = {
  chrome: { label: 'Chrome', color: '#f59e0b' },
  manganese: { label: 'Manganese', color: '#a78bfa' },
  iron_ore: { label: 'Iron Ore', color: '#60a5fa' },
  coal: { label: 'Coal', color: '#6b7280' },
  aggregates: { label: 'Aggregates', color: '#f97316' },
  platinum: { label: 'Platinum (PGMs)', color: '#c0c0c0' },
  gold: { label: 'Gold', color: '#FFD700' },
  copper: { label: 'Copper', color: '#b87333' },
  vanadium: { label: 'Vanadium', color: '#8b5cf6' },
  titanium: { label: 'Titanium', color: '#06b6d4' },
};

export type PricingUnit = 'per_tonne' | 'per_troy_oz' | 'per_lb' | 'per_dmtu';

export const COMMODITY_PRICING: Record<CommodityType, { unit: PricingUnit; label: string; index: string }> = {
  chrome: { unit: 'per_tonne', label: '$/t', index: 'Fastmarkets Chrome' },
  manganese: { unit: 'per_dmtu', label: '$/dmtu', index: 'Metal Bulletin Mn' },
  iron_ore: { unit: 'per_tonne', label: '$/t CFR', index: 'Platts IODEX 62%' },
  coal: { unit: 'per_tonne', label: '$/t FOB', index: 'API4 Richards Bay' },
  aggregates: { unit: 'per_tonne', label: '$/t', index: 'Local spot' },
  platinum: { unit: 'per_troy_oz', label: '$/oz', index: 'LPPM Fix' },
  gold: { unit: 'per_troy_oz', label: '$/oz', index: 'LBMA Gold Price' },
  copper: { unit: 'per_tonne', label: '$/t', index: 'LME Grade A' },
  vanadium: { unit: 'per_lb', label: '$/lb', index: 'Metal Bulletin V\u2082O\u2085' },
  titanium: { unit: 'per_tonne', label: '$/t', index: 'Fastmarkets TiO\u2082' },
};
