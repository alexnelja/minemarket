/**
 * PHASE 2 (FUTURE — when platform has 20+ completed deals):
 *
 * Replace industry averages with platform-derived durations:
 *
 * 1. LOADING TIME: Query deal_milestones for avg days between
 *    'loaded' and 'departed_port' milestones, grouped by port.
 *    SQL: SELECT port, AVG(departed.timestamp - loaded.timestamp) FROM ...
 *
 * 2. TRANSIT TIME: Query deal_milestones for avg days between
 *    'departed_port' and 'arrived_port', grouped by route (port pair).
 *
 * 3. DISCHARGE TIME: Query deal_milestones for avg days between
 *    'arrived_port' and 'delivered', grouped by destination port.
 *
 * 4. PAYMENT TIME: Query deals for avg days between
 *    'delivered' status and 'escrow_released' status.
 *
 * 5. CUSTOMS TIME: Derive from deal document upload timestamps —
 *    time between customs_declaration upload and next milestone.
 *
 * All data already captured in deal_milestones and deals tables.
 * Need ~20 completed deals per route for statistical significance.
 *
 * Implementation: Create lib/platform-derived-timelines.ts that queries
 * the DB and returns overrides for each segment. Merge with defaults
 * using: platformValue || industryAverage.
 *
 * PHASE 3 (FUTURE — with budget for external APIs):
 *
 * Replace estimates with real-time external data:
 *
 * 1. VESSEL ETA — Datalastic /vessel_pro endpoint ($29-49/mo starter)
 *    Returns real ETA for specific vessels based on current position + speed.
 *    Integration: When a deal has a nominated vessel (MMSI), fetch ETA from
 *    Datalastic instead of calculating from distance/speed.
 *    Replaces: ocean_transit segment (currently calculated from searoute distance ÷ 13kn)
 *
 * 2. PORT CONGESTION — Sinay Port Congestion API ($100+/mo)
 *    Real-time congestion for 700+ ports with vessel queue depth and avg wait.
 *    Integration: Replace our AIS-count-based congestion with Sinay's modeled data.
 *    Replaces: vessel_waiting segment (currently AIS count → low/medium/high)
 *    Also useful for: anchorage_wait at destination ports
 *
 * 3. BERTH SCHEDULING — DCSA Port Call Standard 2.0 (free open standard)
 *    When adopted by Transnet/TPT, provides real berth slot data.
 *    Integration: Query planned berth allocation for specific vessel calls.
 *    Replaces: vessel_waiting + vessel_loading with actual scheduled times.
 *    Status: DCSA 2.0 released Jan 2026, SA port adoption pending.
 *
 * 4. VESSEL TRACKING — Datalastic /vessel endpoint ($29-49/mo)
 *    Real-time position, speed, course for nominated deal vessels.
 *    Integration: Track deal shipments with actual vessel position.
 *    Replaces: milestone-based tracking with continuous GPS tracking.
 *    Also provides: current draft (indicates loading status).
 *
 * 5. HISTORICAL ROUTE TIMES — Datalastic /vessel_history ($29-49/mo)
 *    Historical port-to-port transit times for vessel classes.
 *    Integration: Query avg transit time for Supramax vessels on
 *    Richards Bay → Qingdao route from historical AIS data.
 *    Replaces: static 13kn average with route-specific historical averages.
 *
 * 6. WEATHER ROUTING — StormGlass.io ($50/mo) or Open-Meteo (free)
 *    Wave/wind forecasts along the planned route.
 *    Integration: Adjust ocean transit time ±10% based on weather conditions.
 *    Enhancement: Flag when severe weather may delay a shipment.
 *
 * 7. CUSTOMS CLEARANCE — No API available for SARS (SA) or GACC (China).
 *    Best approach: Platform-derived from deal data (Phase 2) or
 *    partner with a digital clearing agent who has EDI access.
 *
 * Cost summary (all external APIs):
 *   Datalastic Starter: $29-49/mo (vessel ETA, tracking, history)
 *   Sinay congestion:   $100+/mo
 *   StormGlass weather: $50/mo
 *   DCSA Port Call:     Free (when ports adopt)
 *   Total:              ~$180-200/mo for full dynamic timeline
 *
 * Priority order:
 *   1. Datalastic vessel ETA (biggest accuracy improvement per $)
 *   2. Sinay port congestion (vessel waiting is highest variance segment)
 *   3. StormGlass weather routing (nice-to-have for transit accuracy)
 *   4. DCSA port call (free but dependent on port adoption)
 */

import type { GeoPoint } from './types';
import { haversineDistance } from './distance';

// Congestion-adjusted waiting times (based on AIS vessel count data)
const CONGESTION_WAIT_DAYS: Record<string, number> = {
  low: 1,
  medium: 3,
  high: 7,
};

// Port-specific loading rates (tonnes/day)
const PORT_LOADING_RATES: Record<string, number> = {
  'Richards Bay': 15000,     // RBCT coal terminal — world class, up to 20,000t/day
  'Saldanha Bay': 18000,     // Iron ore terminal — very fast
  'Durban': 8000,            // Multi-purpose — slower for bulk
  'Port Elizabeth': 8000,    // General bulk
  'Maputo': 6000,            // Older infrastructure
  default: 10000,
};

export interface TimelineSegment {
  segment: string;
  label: string;
  durationDays: number;
  method: 'calculated' | 'estimated' | 'industry_average';
  note: string;
}

export interface SupplyChainTimeline {
  segments: TimelineSegment[];
  totalDays: number;
  buyToSellDays: number;  // Only the segments between buy and sell points
}

// Rail speeds (km/day, accounting for scheduling, loading, and single-line sections)
const RAIL_SPEEDS = {
  heavy_haul: 450,     // Heavy haul (OREX, Coal Line) — ~30km/h but only runs ~15h/day
  mainline: 350,       // Mainline corridors — ~25km/h effective
  branch: 200,         // Branch lines — slower, less frequent
};

// Road speeds (km/day for bulk tippers)
const ROAD_SPEED = 500; // ~60km/h for 8h driving/day

// SA-specific route data (research-backed estimates)
const SA_RAIL_ROUTES: Record<string, { distanceKm: number; railType: keyof typeof RAIL_SPEEDS; note: string }> = {
  // ── Chrome (Bushveld Complex) ─────────────────────────────────────────
  'Steelpoort Chrome→Richards Bay':  { distanceKm: 620, railType: 'mainline', note: 'NorthCor via Belfast, Ogies to Coal Line' },
  'Steelpoort Chrome→Durban':       { distanceKm: 550, railType: 'mainline', note: 'Via Ermelo, Natal mainline' },
  'Steelpoort Chrome→Maputo':       { distanceKm: 380, railType: 'mainline', note: 'Maputo Corridor (Belfast→Komatipoort→Ressano Garcia)' },
  'Middelburg Chrome→Richards Bay': { distanceKm: 520, railType: 'mainline', note: 'NorthCor via Ogies to Coal Line' },
  'Middelburg Chrome→Maputo':       { distanceKm: 450, railType: 'mainline', note: 'Maputo Corridor via Nelspruit' },
  'Middelburg Chrome→Durban':       { distanceKm: 500, railType: 'mainline', note: 'Via Ermelo, Natal mainline' },
  'Rustenburg Chrome→Maputo':       { distanceKm: 520, railType: 'mainline', note: 'Maputo Corridor via Pretoria, Nelspruit' },
  'Rustenburg Chrome→Richards Bay': { distanceKm: 700, railType: 'mainline', note: 'NorthCor via Pretoria, Ogies to Coal Line' },
  'Rustenburg Chrome→Durban':       { distanceKm: 620, railType: 'mainline', note: 'Via Germiston, Natal mainline' },

  // ── Manganese (Kalahari Basin) ────────────────────────────────────────
  'Hotazel Manganese→Saldanha Bay':    { distanceKm: 861, railType: 'heavy_haul', note: 'Hotazel→Sishen junction→OREX Line to Saldanha MPT' },
  'Hotazel Manganese→Port Elizabeth':  { distanceKm: 1050, railType: 'mainline', note: 'Cape Corridor via De Aar (legacy terminal, 4 Mtpa)' },
  'Hotazel Manganese→Ngqura':         { distanceKm: 1003, railType: 'mainline', note: 'Cape Corridor via De Aar — dedicated Mn terminal (6→16 Mtpa)' },
  'Hotazel Manganese→Durban':         { distanceKm: 1100, railType: 'mainline', note: 'Via Kimberley, Bloemfontein, Natal mainline' },
  'Hotazel Manganese→East London':    { distanceKm: 1000, railType: 'mainline', note: 'New route activated 2024, targeting 1+ Mtpa' },

  // ── Iron Ore (Northern Cape) ──────────────────────────────────────────
  'Sishen Iron Ore→Saldanha Bay':  { distanceKm: 861, railType: 'heavy_haul', note: 'OREX Line — dedicated heavy-haul (60 Mtpa capacity)' },

  // ── Coal (Mpumalanga / Waterberg) ─────────────────────────────────────
  'Emalahleni Coal→Richards Bay':  { distanceKm: 588, railType: 'heavy_haul', note: 'Coal Line via Ermelo, Vryheid (RBCT 91 Mtpa design)' },
  'Ermelo Coal→Richards Bay':      { distanceKm: 350, railType: 'heavy_haul', note: 'Coal Line direct — 200-wagon trains, electrified' },
  'Waterberg Coal→Richards Bay':   { distanceKm: 550, railType: 'mainline', note: 'Via Ogies junction to Coal Line' },
  'Emalahleni Coal→Maputo':        { distanceKm: 500, railType: 'mainline', note: 'Maputo Corridor — secondary coal export route' },
  'Lephalale Coal→Richards Bay':   { distanceKm: 600, railType: 'mainline', note: 'Waterberg via Ogies junction to Coal Line' },

  // ── Copper (Limpopo) ──────────────────────────────────────────────────
  'Phalaborwa Copper→Richards Bay': { distanceKm: 400, railType: 'mainline', note: 'Via Kaapmuiden, 1986 rail extension' },
  'Phalaborwa Copper→Maputo':      { distanceKm: 350, railType: 'mainline', note: 'Maputo Corridor via Komatipoort' },

  // ── Platinum (Bushveld Complex) ───────────────────────────────────────
  // Platinum moves primarily by armoured road, not rail. These are approximate.
  'Rustenburg Platinum→Durban':     { distanceKm: 620, railType: 'mainline', note: 'Concentrate by rail; refined PGMs by armoured road/air' },
  'Rustenburg Platinum→Richards Bay': { distanceKm: 700, railType: 'mainline', note: 'Concentrate only — refined PGMs via OR Tambo air freight' },

  // ── Titanium / Mineral Sands ──────────────────────────────────────────
  'Richards Bay Minerals→Richards Bay': { distanceKm: 5, railType: 'branch', note: 'Mine-to-port — adjacent operations (Rio Tinto RBM)' },

  // ── Vanadium (Mpumalanga) ─────────────────────────────────────────────
  'Brits Vanadium→Durban':        { distanceKm: 600, railType: 'mainline', note: 'Via Germiston, Natal mainline' },
  'Brits Vanadium→Richards Bay':  { distanceKm: 680, railType: 'mainline', note: 'NorthCor via Ogies to Coal Line' },
};

// Port operations (industry averages for SA bulk terminals)
const PORT_OPERATIONS = {
  stockpile_receival: { days: 1, note: 'Unload rail/trucks to stockpile' },
  quality_sampling: { days: 1, note: 'Sampling, lab analysis (SGS/BV)' },
  vessel_nomination: { days: 2, note: 'Nominate vessel, confirm laycan' },
  vessel_waiting: { days: 3, note: 'Average vessel waiting time (varies by port congestion)' },
  loading: { days: 2, note: 'Loading rate ~8,000-15,000 t/day depending on terminal' },
  customs_export: { days: 1, note: 'SAD500 filing, customs clearance' },
  documentation: { days: 1, note: 'BOL issuance, certificates' },
};

// Discharge operations (destination port)
const DISCHARGE_OPERATIONS = {
  anchorage_wait: { days: 2, note: 'Average anchorage waiting time at destination' },
  discharge: { days: 3, note: 'Discharge rate varies by port equipment' },
  customs_import: { days: 3, note: 'Import customs, duties, clearance' },
  delivery_to_buyer: { days: 2, note: 'Final delivery from port to buyer facility' },
};

// Payment timeline
const PAYMENT_TIMELINE = {
  lc_presentation: { days: 3, note: 'Present documents to bank under LC' },
  bank_processing: { days: 5, note: 'Bank reviews and processes payment' },
  funds_receipt: { days: 3, note: 'Funds transfer to seller account' },
};

export interface TimelineParams {
  mineCoords?: GeoPoint;
  portCoords: GeoPoint;
  destinationCoords?: GeoPoint;
  mineName?: string;
  portName: string;
  destinationName?: string;
  transportMode: 'rail' | 'road';
  volumeTonnes: number;
  buyPoint: string;
  sellPoint: string;
  includePaymentTimeline?: boolean;
  portCongestion?: { level: string; vesselCount: number };
  loadingRateOverride?: number;  // Terminal-specific loading rate (t/day)
  averageSeaSpeed?: number;      // AIS-derived average if available (knots)
}

export function calculateTimeline(params: TimelineParams): SupplyChainTimeline {
  const {
    mineCoords, portCoords, destinationCoords, mineName, portName,
    destinationName, transportMode, volumeTonnes, buyPoint, sellPoint,
    includePaymentTimeline = false,
  } = params;

  const segments: TimelineSegment[] = [];

  // === INLAND SEGMENT ===
  if (mineCoords && ['mine_gate', 'stockpile'].includes(buyPoint)) {
    // Try to find a known route
    const routeKey = Object.keys(SA_RAIL_ROUTES).find(k =>
      mineName && k.toLowerCase().includes(mineName.toLowerCase().split(' ')[0])
      && k.toLowerCase().includes(portName.toLowerCase().split(' ')[0])
    );

    let distanceKm: number;
    let transitDays: number;
    let method: 'calculated' | 'estimated' = 'calculated';

    if (routeKey && transportMode === 'rail') {
      const route = SA_RAIL_ROUTES[routeKey];
      distanceKm = route.distanceKm;
      transitDays = Math.ceil(distanceKm / RAIL_SPEEDS[route.railType]);
      segments.push({
        segment: 'mine_loading',
        label: 'Mine loading & dispatch',
        durationDays: 1,
        method: 'industry_average',
        note: 'Loading wagons/trucks at mine',
      });
      segments.push({
        segment: 'inland_transit',
        label: `Rail transit to ${portName}`,
        durationDays: transitDays,
        method,
        note: `${distanceKm}km via ${route.note}`,
      });
    } else {
      // haversineDistance returns nautical miles — convert to km
      distanceKm = haversineDistance(mineCoords.lat, mineCoords.lng, portCoords.lat, portCoords.lng) * 1.852 * 1.3;
      if (transportMode === 'rail') {
        transitDays = Math.ceil(distanceKm / RAIL_SPEEDS.mainline);
      } else {
        transitDays = Math.ceil(distanceKm / ROAD_SPEED);
      }
      method = 'estimated';
      segments.push({
        segment: 'mine_loading',
        label: 'Mine loading & dispatch',
        durationDays: 1,
        method: 'industry_average',
        note: `Loading ${transportMode === 'rail' ? 'wagons' : 'trucks'} at mine`,
      });
      segments.push({
        segment: 'inland_transit',
        label: `${transportMode === 'rail' ? 'Rail' : 'Road'} transit to ${portName}`,
        durationDays: transitDays,
        method,
        note: `~${Math.round(distanceKm)}km by ${transportMode}`,
      });
    }
  }

  // === PORT OPERATIONS ===
  const portPoints = ['mine_gate', 'stockpile', 'port_gate', 'fob'];
  const isPortRelevant = portPoints.includes(buyPoint) && ['fob', 'cfr', 'cif'].includes(sellPoint);

  if (isPortRelevant) {
    segments.push({ segment: 'stockpile_receival', label: 'Port receival & stockpiling', durationDays: PORT_OPERATIONS.stockpile_receival.days, method: 'industry_average', note: PORT_OPERATIONS.stockpile_receival.note });
    segments.push({ segment: 'quality_sampling', label: 'Quality sampling & analysis', durationDays: PORT_OPERATIONS.quality_sampling.days, method: 'industry_average', note: PORT_OPERATIONS.quality_sampling.note });
    segments.push({ segment: 'vessel_nomination', label: 'Vessel nomination', durationDays: PORT_OPERATIONS.vessel_nomination.days, method: 'industry_average', note: PORT_OPERATIONS.vessel_nomination.note });
    // Vessel waiting — dynamic from port congestion data if available
    const waitDays = params.portCongestion
      ? CONGESTION_WAIT_DAYS[params.portCongestion.level] || 3
      : PORT_OPERATIONS.vessel_waiting.days;
    segments.push({
      segment: 'vessel_waiting',
      label: 'Vessel waiting for berth',
      durationDays: waitDays,
      method: params.portCongestion ? 'calculated' : 'estimated',
      note: params.portCongestion
        ? `AIS data: ${params.portCongestion.vesselCount} vessels at ${portName} (${params.portCongestion.level} congestion)`
        : `${PORT_OPERATIONS.vessel_waiting.note}. No live congestion data for ${portName}.`,
    });

    // Loading time based on volume and port-specific loading rate
    const loadingRate = params.loadingRateOverride
      || PORT_LOADING_RATES[portName]
      || PORT_LOADING_RATES.default;
    const loadingDays = Math.max(1, Math.ceil(volumeTonnes / loadingRate));
    segments.push({
      segment: 'vessel_loading',
      label: 'Vessel loading',
      durationDays: loadingDays,
      method: 'calculated',
      note: `${volumeTonnes.toLocaleString()}t at ${loadingRate.toLocaleString()}t/day (${portName} rate)`,
    });

    segments.push({ segment: 'customs_export', label: 'Export customs clearance', durationDays: PORT_OPERATIONS.customs_export.days, method: 'industry_average', note: PORT_OPERATIONS.customs_export.note });
    segments.push({ segment: 'documentation', label: 'Documentation (BOL, certificates)', durationDays: PORT_OPERATIONS.documentation.days, method: 'industry_average', note: PORT_OPERATIONS.documentation.note });
  }

  // === OCEAN TRANSIT ===
  if (destinationCoords && ['cfr', 'cif'].includes(sellPoint)) {
    // Use haversine with sea route multiplier (haversineDistance returns nm)
    const distanceNm = haversineDistance(portCoords.lat, portCoords.lng, destinationCoords.lat, destinationCoords.lng) * 1.4;

    const seaSpeed = params.averageSeaSpeed || 13; // AIS-derived or default 13 knots
    const seaDays = Math.ceil(distanceNm / (seaSpeed * 24));

    segments.push({
      segment: 'ocean_transit',
      label: `Ocean transit to ${destinationName || 'destination'}`,
      durationDays: seaDays,
      method: params.averageSeaSpeed ? 'calculated' : 'estimated',
      note: params.averageSeaSpeed
        ? `${Math.round(distanceNm).toLocaleString()} nm at ~${seaSpeed} knots (AIS fleet average)`
        : `${Math.round(distanceNm).toLocaleString()} nm at ~${seaSpeed} knots (industry average)`,
    });
  }

  // === DISCHARGE OPERATIONS ===
  if (['cfr', 'cif'].includes(sellPoint)) {
    segments.push({ segment: 'anchorage_wait', label: 'Anchorage waiting', durationDays: DISCHARGE_OPERATIONS.anchorage_wait.days, method: 'estimated', note: DISCHARGE_OPERATIONS.anchorage_wait.note });
    segments.push({ segment: 'discharge', label: 'Vessel discharge', durationDays: DISCHARGE_OPERATIONS.discharge.days, method: 'industry_average', note: DISCHARGE_OPERATIONS.discharge.note });
    segments.push({ segment: 'customs_import', label: 'Import customs clearance', durationDays: DISCHARGE_OPERATIONS.customs_import.days, method: 'estimated', note: DISCHARGE_OPERATIONS.customs_import.note });
  }

  // === PAYMENT TIMELINE ===
  if (includePaymentTimeline) {
    segments.push({ segment: 'lc_presentation', label: 'LC document presentation', durationDays: PAYMENT_TIMELINE.lc_presentation.days, method: 'industry_average', note: PAYMENT_TIMELINE.lc_presentation.note });
    segments.push({ segment: 'bank_processing', label: 'Bank processing', durationDays: PAYMENT_TIMELINE.bank_processing.days, method: 'industry_average', note: PAYMENT_TIMELINE.bank_processing.note });
    segments.push({ segment: 'funds_receipt', label: 'Funds transfer', durationDays: PAYMENT_TIMELINE.funds_receipt.days, method: 'industry_average', note: PAYMENT_TIMELINE.funds_receipt.note });
  }

  const totalDays = segments.reduce((s, seg) => s + seg.durationDays, 0);

  return { segments, totalDays, buyToSellDays: totalDays };
}

// Export constants for use elsewhere
export { SA_RAIL_ROUTES, PORT_OPERATIONS, DISCHARGE_OPERATIONS, PAYMENT_TIMELINE, PORT_LOADING_RATES, CONGESTION_WAIT_DAYS };
