/**
 * Shared shipping, port, and tariff constants used across the waterfall calculators.
 *
 * Single source of truth for:
 * - Port charges (TNPA tariffs)
 * - Royalty rates (MPRRA)
 * - Inland transport rates (TFR rail, road freight)
 * - Insurance, survey, weighbridge, discharge fees
 * - Commodity-specific multipliers
 *
 * Imported by: forward-waterfall.ts, reverse-waterfall.ts, route-optimizer.ts
 */

// ── Port charges by terminal ($/t) ─────────────────────────────────────────
// Source: Transnet National Ports Authority tariff schedules 2025/26

export const PORT_CHARGES: Record<string, {
  handling: number; wharfage: number; stevedoring: number; crosshaul: number;
  agency: number; security: number; customs_broker: number; storage_per_week: number;
}> = {
  'Richards Bay':    { handling: 4.00, wharfage: 1.20, stevedoring: 3.00, crosshaul: 1.50, agency: 0.30, security: 0.10, customs_broker: 0.40, storage_per_week: 1.80 },
  'Saldanha Bay':    { handling: 3.80, wharfage: 1.10, stevedoring: 2.80, crosshaul: 1.20, agency: 0.30, security: 0.10, customs_broker: 0.40, storage_per_week: 1.50 },
  'Durban':          { handling: 4.50, wharfage: 1.40, stevedoring: 3.50, crosshaul: 2.00, agency: 0.35, security: 0.12, customs_broker: 0.45, storage_per_week: 2.00 },
  'Port Elizabeth':  { handling: 4.20, wharfage: 1.30, stevedoring: 3.20, crosshaul: 1.80, agency: 0.30, security: 0.10, customs_broker: 0.40, storage_per_week: 1.70 },
  'Ngqura':          { handling: 3.60, wharfage: 1.10, stevedoring: 2.60, crosshaul: 1.20, agency: 0.30, security: 0.10, customs_broker: 0.40, storage_per_week: 1.40 },
  'Maputo':          { handling: 5.00, wharfage: 1.60, stevedoring: 3.80, crosshaul: 2.20, agency: 0.50, security: 0.15, customs_broker: 0.60, storage_per_week: 2.20 },
  default:           { handling: 4.50, wharfage: 1.30, stevedoring: 3.20, crosshaul: 1.80, agency: 0.35, security: 0.10, customs_broker: 0.45, storage_per_week: 1.80 },
};

// ── Mineral royalty rates (MPRRA) ───────────────────────────────────────────
// Source: Mineral & Petroleum Resources Royalty Act, effective rates by commodity

export const ROYALTY_RATES: Record<string, number> = {
  chrome: 0.03, manganese: 0.03, iron_ore: 0.04, coal: 0.02, aggregates: 0.01,
  platinum: 0.05, gold: 0.05, copper: 0.03, vanadium: 0.03, titanium: 0.03,
};

// ── Inland transport rates ──────────────────────────────────────────────────
// Source: TFR published tariffs (rail), road freight industry average (road)

export const INLAND_RATES = {
  rail: { perTonneKm: 0.032, fixedPerShipment: 200 },
  road: { perTonneKm: 0.18, fixedPerShipment: 50 },
};

// ── Fixed per-tonne fees ────────────────────────────────────────────────────

export const INSURANCE_RATE = 0.0015;    // 0.15% of cargo value (marine cargo insurance)
export const SURVEY_SAMPLING = 0.70;     // Independent surveyor/sampling per tonne
export const WEIGHBRIDGE = 0.27;         // Per-truck weighbridge at mine
export const DISCHARGE_FEES = 4.50;      // Destination port discharge per tonne

// ── Commodity-specific handling multiplier ──────────────────────────────────
// Applied to port handling, stevedoring, crosshaul charges
// Source: TNPA tariff schedules, industry benchmarks (2024-2025)

export const COMMODITY_HANDLING_MULTIPLIER: Record<string, number> = {
  coal: 0.80,
  iron_ore: 0.85,
  aggregates: 0.80,
  manganese: 1.00,
  chrome: 1.05,
  copper: 1.15,
  titanium: 1.10,
  vanadium: 1.25,
  platinum: 1.80,
  gold: 2.50,
};

// ── Commodity-specific transport multiplier (rail and road) ─────────────────
// Source: TFR tariffs, road transport benchmarks, corridor-specific data

export const COMMODITY_TRANSPORT_MULTIPLIER: Record<string, { rail: number; road: number }> = {
  coal:       { rail: 0.85, road: 0.90 },
  iron_ore:   { rail: 0.80, road: 1.00 },
  manganese:  { rail: 0.95, road: 1.10 },
  chrome:     { rail: 1.05, road: 1.31 },
  copper:     { rail: 1.10, road: 1.05 },
  aggregates: { rail: 0.85, road: 0.85 },
  platinum:   { rail: 1.50, road: 1.80 },
  gold:       { rail: 2.00, road: 2.20 },
  titanium:   { rail: 0.90, road: 0.90 },
  vanadium:   { rail: 1.15, road: 1.10 },
};

// ── Road transport distance limits (km) ─────────────────────────────────────

export const ROAD_MAX_KM: Record<string, number> = {
  chrome: 900,
  manganese: 1100,
  default: 500,
};

// ── Reference grades for price adjustment ───────────────────────────────────

export const REFERENCE_GRADES: Record<string, number> = {
  chrome: 42,      // 42% Cr2O3 — SA concentrate benchmark
  manganese: 37,   // 37% Mn — SA ore benchmark
};
