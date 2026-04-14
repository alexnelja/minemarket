import type { GeoPoint, CommodityType } from './types';
import { calculateSeaRoute } from './sea-routes';
import { haversineDistance } from './distance';
import {
  FX_HEDGE_COSTS, COMMODITY_HEDGE_COSTS, type FxHedgeType,
} from './price-waterfall';
import type { DataQuality } from './data-sources';
import {
  PORT_CHARGES, ROYALTY_RATES, INLAND_RATES,
  INSURANCE_RATE, SURVEY_SAMPLING, WEIGHBRIDGE, DISCHARGE_FEES,
} from './shipping-constants';

// ── Trade point types ──────────────────────────────────────────────────────

export type TradePoint = 'mine_gate' | 'stockpile' | 'port_gate' | 'fob' | 'cfr' | 'cif';

export const CORRIDOR_POINTS: { key: TradePoint; label: string; category: string }[] = [
  { key: 'mine_gate', label: 'Mine Gate (EXW)', category: 'Mine' },
  { key: 'stockpile', label: 'Stockpile (at port)', category: 'Port' },
  { key: 'port_gate', label: 'Port Gate (FCA)', category: 'Port' },
  { key: 'fob', label: 'FOB (loaded on vessel)', category: 'Port' },
  { key: 'cfr', label: 'CFR (cost + freight)', category: 'Ocean' },
  { key: 'cif', label: 'CIF (cost, insurance, freight)', category: 'Destination' },
];

// Corridor positions — costs between adjacent points
export type CostPosition =
  | 'mine_to_stockpile'
  | 'stockpile_to_portgate'
  | 'portgate_to_fob'
  | 'fob_to_cfr'
  | 'cfr_to_cif';

const POSITION_ORDER: CostPosition[] = [
  'mine_to_stockpile',
  'stockpile_to_portgate',
  'portgate_to_fob',
  'fob_to_cfr',
  'cfr_to_cif',
];

// Map each trade point to the corridor index where costs START (first segment after that point)
export const POINT_TO_START: Record<TradePoint, number> = {
  mine_gate: 0,
  stockpile: 1,
  port_gate: 2,
  fob: 3,
  cfr: 4,
  cif: 5,
};

// Map each trade point to the corridor index where costs END (exclusive upper bound)
export const POINT_TO_END: Record<TradePoint, number> = {
  mine_gate: 0,
  stockpile: 1,
  port_gate: 2,
  fob: 3,
  cfr: 4,
  cif: 5,
};

/** Returns true if `point` is at or after `reference` in the corridor */
export function isAtOrAfter(point: TradePoint, reference: TradePoint): boolean {
  return POINT_TO_START[point] >= POINT_TO_START[reference];
}

/** Returns valid sell points for a given buy point (must come strictly after) */
export function getValidSellPoints(buyPoint: TradePoint): TradePoint[] {
  const buyIdx = POINT_TO_START[buyPoint];
  return CORRIDOR_POINTS.filter(p => POINT_TO_END[p.key] > buyIdx).map(p => p.key);
}

// ── Interfaces ─────────────────────────────────────────────────────────────

export interface ForwardWaterfallStep {
  label: string;
  amount: number;       // $/t (positive = cost added)
  subtotal: number;     // running subtotal
  category: 'cost' | 'freight' | 'port' | 'tax' | 'inland' | 'finance' | 'price';
  note?: string;
  editable?: boolean;
  sourceId?: string;     // References DATA_SOURCES key
  quality?: DataQuality; // 'published' | 'calculated' | 'estimated' | 'placeholder'
}

export interface TradeFinancing {
  lcCostPct?: number;
  interestRatePct?: number;
  financingDays?: number;
  creditInsurancePct?: number;
}

export interface CorridorPoint {
  point: TradePoint;
  label: string;
  price: number;
  isActive: boolean;
}

export interface DealSimulation {
  buyPoint: TradePoint;
  sellPoint: TradePoint;
  buyPrice: number;
  sellPrice: number;           // Your all-in cost at sell point
  indexSellPrice: number | null;  // Market price at sell point
  margin: number | null;
  marginPct: number | null;
  totalProfit: number | null;
  breakevenBuyPrice: number | null;
  estimatedDaysToDelivery: number;
  steps: ForwardWaterfallStep[];
  currency: string;
  financing: {
    totalFinancingCost: number;
    workingCapitalDays: number;
    interestCost: number;
    lcCost: number;
    insuranceCost: number;
  } | null;
  corridor: CorridorPoint[];

  // Legacy fields for backward compatibility
  mineGatePrice: number;
  fcaPortPrice: number;
  fobPrice: number;
  cifPrice: number;
  totalDeliveredCost: number;
  indexCifPrice: number | null;
  breakevenMineGate: number | null;
}

// Cost constants imported from lib/shipping-constants.ts (single source of truth)

const STAGE_DURATIONS = {
  mine_to_port_rail: 3,
  mine_to_port_road: 2,
  port_staging: 5,
  ocean_transit_per_1000nm: 3.2,
  discharge_and_customs: 5,
  payment_after_delivery: 14,
};

// ── SimulationParams ───────────────────────────────────────────────────────

export interface SimulationParams {
  buyPoint?: TradePoint;       // Default: 'mine_gate'
  sellPoint?: TradePoint;      // Default: 'cif'
  buyPrice?: number;           // Price at buy point ($/t) — replaces mineGatePrice when buyPoint is set
  /** @deprecated Use buyPrice + buyPoint instead */
  mineGatePrice?: number;
  commodity: CommodityType;
  volumeTonnes: number;
  loadingPort: string;
  loadingPortCoords: GeoPoint;
  destinationCoords: GeoPoint;
  destinationName?: string;
  mineCoords?: GeoPoint;
  mineName?: string;
  transportMode?: 'rail' | 'road';
  storageDays?: number;
  fxHedge?: FxHedgeType;
  hedgeCommodityPrice?: boolean;
  dealCurrency?: string;
  dealDurationMonths?: number;
  indexCifPrice?: number;      // CIF index — we derive FOB/CFR from it
  financing?: TradeFinancing;
}

// ── Main simulation function ───────────────────────────────────────────────

export function simulateDeal(params: SimulationParams): DealSimulation {
  const {
    commodity, volumeTonnes, loadingPort, loadingPortCoords,
    destinationCoords, destinationName, mineCoords, mineName,
    transportMode = 'rail', storageDays = 0,
    fxHedge = 'spot', hedgeCommodityPrice = false,
    dealCurrency = 'USD', dealDurationMonths = 3,
    indexCifPrice, financing,
  } = params;

  // Resolve buy/sell points (backward compatible)
  const buyPoint: TradePoint = params.buyPoint || 'mine_gate';
  const sellPoint: TradePoint = params.sellPoint || 'cif';
  const buyPrice = params.buyPrice ?? params.mineGatePrice ?? 0;

  const startIdx = POINT_TO_START[buyPoint];
  const endIdx = POINT_TO_END[sellPoint];

  // Helper: is a corridor position included in this deal?
  function isPositionActive(pos: CostPosition): boolean {
    const posIdx = POSITION_ORDER.indexOf(pos);
    return posIdx >= startIdx && posIdx < endIdx;
  }

  const steps: ForwardWaterfallStep[] = [];
  let subtotal = buyPrice;

  // Buy point marker
  const buyLabel = CORRIDOR_POINTS.find(p => p.key === buyPoint)?.label || buyPoint;
  steps.push({
    label: `Buy price (${buyLabel})`,
    amount: buyPrice,
    subtotal,
    category: 'price',
    note: mineName && buyPoint === 'mine_gate' ? `Purchase at ${mineName}` : `Purchase price at ${buyLabel}`,
    editable: true,
  });

  // ── Corridor price tracker (for corridor visualization) ──
  // We build this as we go, tracking the cumulative price at each point
  const corridorPrices: Record<TradePoint, number> = {
    mine_gate: 0, stockpile: 0, port_gate: 0, fob: 0, cfr: 0, cif: 0,
  };
  corridorPrices[buyPoint] = buyPrice;

  // ── SEGMENT: mine_gate → stockpile (weighbridge + inland transport) ──
  if (isPositionActive('mine_to_stockpile')) {
    subtotal += WEIGHBRIDGE;
    steps.push({ label: 'Weighbridge', amount: WEIGHBRIDGE, subtotal, category: 'inland', note: 'Per-truck weighbridge at mine', quality: 'estimated' });

    if (mineCoords) {
      const inlandDistKm = haversineDistance(mineCoords.lat, mineCoords.lng, loadingPortCoords.lat, loadingPortCoords.lng) * 1.852 * 1.3;
      const rates = INLAND_RATES[transportMode];
      const inlandCost = (inlandDistKm * rates.perTonneKm) + (rates.fixedPerShipment / volumeTonnes);
      subtotal += inlandCost;
      steps.push({
        label: `Inland ${transportMode} freight`,
        amount: inlandCost,
        subtotal,
        category: 'inland',
        note: `${Math.round(inlandDistKm)}km ${transportMode} to ${loadingPort}`,
        editable: true,
        sourceId: transportMode === 'rail' ? 'transnet_rail' : 'road_freight',
        quality: 'estimated',
      });
    }

    corridorPrices.stockpile = subtotal;
    steps.push({ label: '= At Stockpile', amount: 0, subtotal, category: 'price', note: `Delivered to ${loadingPort} stockpile` });
  }

  // ── SEGMENT: stockpile → port_gate (crosshaul) ──
  if (isPositionActive('stockpile_to_portgate')) {
    const port = PORT_CHARGES[loadingPort] || PORT_CHARGES.default;
    subtotal += port.crosshaul;
    steps.push({ label: 'Crosshaul', amount: port.crosshaul, subtotal, category: 'port', note: 'Stockpile to quayside', editable: true, sourceId: 'port_tariffs', quality: 'published' });

    corridorPrices.port_gate = subtotal;
    steps.push({ label: '= FCA Port Gate', amount: 0, subtotal, category: 'price', note: `Delivered to ${loadingPort} gate` });
  }

  // ── SEGMENT: port_gate → fob (stevedoring, handling, wharfage, agency, security, customs, royalty, surveyor, storage) ──
  if (isPositionActive('portgate_to_fob')) {
    const port = PORT_CHARGES[loadingPort] || PORT_CHARGES.default;

    const portCosts = [
      { label: 'Stevedoring', amount: port.stevedoring, note: 'Loading cargo onto vessel' },
      { label: 'Terminal handling', amount: port.handling, note: `${loadingPort} TPT charges` },
      { label: 'Wharfage', amount: port.wharfage, note: 'TNPA wharfage levy' },
      { label: 'Port agency', amount: port.agency, note: 'Ship agent fees' },
      { label: 'Port security', amount: port.security, note: 'ISPS levy' },
      { label: 'Customs broker', amount: port.customs_broker, note: 'SAD500 filing + clearing' },
    ];

    for (const cost of portCosts) {
      subtotal += cost.amount;
      steps.push({ label: cost.label, amount: cost.amount, subtotal, category: 'port', note: cost.note, editable: true, sourceId: 'port_tariffs', quality: 'published' });
    }

    // Royalty (on FOB value — circular, so approximate on current subtotal)
    const royaltyRate = ROYALTY_RATES[commodity] || 0.03;
    const royaltyCost = subtotal * royaltyRate;
    subtotal += royaltyCost;
    steps.push({ label: 'Mineral royalty', amount: royaltyCost, subtotal, category: 'tax', note: `MPRRA ~${(royaltyRate * 100).toFixed(1)}% of FOB`, editable: true, sourceId: 'mprra_royalty', quality: 'estimated' });

    // Surveyor
    subtotal += SURVEY_SAMPLING;
    steps.push({ label: 'Surveyor & sampling', amount: SURVEY_SAMPLING, subtotal, category: 'port', note: 'Independent inspection at port', quality: 'estimated' });

    // Storage
    if (storageDays > 0) {
      const storageWeeks = Math.ceil(storageDays / 7);
      const storageCost = storageWeeks * port.storage_per_week;
      subtotal += storageCost;
      steps.push({ label: 'Terminal storage', amount: storageCost, subtotal, category: 'port', note: `${storageDays} days at ${loadingPort}`, editable: true, sourceId: 'port_tariffs', quality: 'published' });
    }

    corridorPrices.fob = subtotal;
    steps.push({ label: '= FOB Price', amount: 0, subtotal, category: 'price', note: `Free On Board at ${loadingPort}` });
  }

  // ── SEGMENT: fob → cfr (ocean freight + discharge) ──
  let freightPerTonne = 0;
  let transitDays = 0;
  let routeDistanceNm = 0;

  if (isPositionActive('fob_to_cfr') || isPositionActive('cfr_to_cif')) {
    // Always calculate ocean route for timeline even if not costing freight
    try {
      const route = calculateSeaRoute(loadingPortCoords, destinationCoords, volumeTonnes);
      freightPerTonne = route.freightRatePerTonne;
      transitDays = route.transitDays;
      routeDistanceNm = route.distanceNm;
    } catch {
      const distNm = haversineDistance(loadingPortCoords.lat, loadingPortCoords.lng, destinationCoords.lat, destinationCoords.lng) * 1.4;
      freightPerTonne = distNm * 0.002;
      transitDays = Math.ceil(distNm / (13 * 24));
      routeDistanceNm = distNm;
    }
  }

  if (isPositionActive('fob_to_cfr')) {
    subtotal += freightPerTonne;
    steps.push({ label: 'Ocean freight', amount: freightPerTonne, subtotal, category: 'freight', note: `${loadingPort} → ${destinationName || 'destination'} (${Math.round(routeDistanceNm).toLocaleString()} nm)`, editable: true, sourceId: 'vessel_economics', quality: 'calculated' });

    // Discharge fees are part of getting to CFR (cost + freight includes discharge)
    subtotal += DISCHARGE_FEES;
    steps.push({ label: 'Discharge port fees', amount: DISCHARGE_FEES, subtotal, category: 'freight', note: 'Destination port handling + stevedoring', quality: 'estimated' });

    corridorPrices.cfr = subtotal;
    steps.push({ label: '= CFR Price', amount: 0, subtotal, category: 'price', note: `Cost & Freight at ${destinationName || 'destination'}` });
  }

  // ── SEGMENT: cfr → cif (marine insurance) ──
  if (isPositionActive('cfr_to_cif')) {
    const insuranceCost = subtotal * INSURANCE_RATE;
    subtotal += insuranceCost;
    steps.push({ label: 'Marine insurance', amount: insuranceCost, subtotal, category: 'freight', note: `${(INSURANCE_RATE * 100).toFixed(2)}% of cargo value`, quality: 'calculated' });

    corridorPrices.cif = subtotal;
    steps.push({ label: '= CIF Price (delivered)', amount: 0, subtotal, category: 'price', note: `Cost, Insurance & Freight at ${destinationName || 'destination'}` });
  }

  // ── HEDGING COSTS (apply on top regardless of buy/sell point) ──
  const fxHedgeConfig = FX_HEDGE_COSTS[fxHedge];
  if (fxHedge !== 'spot' && dealCurrency !== 'USD') {
    const hedgeDuration = Math.min(fxHedgeConfig.months, dealDurationMonths);
    const fxCost = subtotal * (fxHedgeConfig.annualizedPct / 100) * (hedgeDuration / 12);
    subtotal += fxCost;
    steps.push({ label: `FX hedge (${fxHedgeConfig.label})`, amount: fxCost, subtotal, category: 'finance', note: `${fxHedgeConfig.annualizedPct}% p.a. × ${hedgeDuration}m`, editable: true, sourceId: 'fx_hedge_cost', quality: 'estimated' });
  }

  if (hedgeCommodityPrice) {
    const hedge = COMMODITY_HEDGE_COSTS[commodity];
    if (hedge?.available) {
      const hedgeCost = subtotal * (hedge.costPct / 100) * (dealDurationMonths / 12);
      subtotal += hedgeCost;
      steps.push({ label: `Price hedge (${hedge.instrument})`, amount: hedgeCost, subtotal, category: 'finance', note: `${hedge.exchange} — ${hedge.costPct}% p.a.`, editable: true, quality: 'calculated' });
    }
  }

  // ── TRADE FINANCING (apply on top regardless of buy/sell point) ──
  let financingResult = null;
  if (financing) {
    const dealValue = subtotal * volumeTonnes;
    const lcCost = financing.lcCostPct ? dealValue * (financing.lcCostPct / 100) / volumeTonnes : 0;
    const financingDays = financing.financingDays || (transitDays + STAGE_DURATIONS.mine_to_port_rail + STAGE_DURATIONS.port_staging + STAGE_DURATIONS.discharge_and_customs + STAGE_DURATIONS.payment_after_delivery);
    const interestRate = financing.interestRatePct || 11.5;
    const interestCost = (buyPrice * volumeTonnes) * (interestRate / 100) * (financingDays / 365) / volumeTonnes;
    const insuranceCreditCost = financing.creditInsurancePct ? dealValue * (financing.creditInsurancePct / 100) / volumeTonnes : 0;
    const totalFinancingCost = lcCost + interestCost + insuranceCreditCost;

    if (lcCost > 0) {
      subtotal += lcCost;
      steps.push({ label: 'Letter of credit', amount: lcCost, subtotal, category: 'finance', note: `${financing.lcCostPct}% of deal value`, editable: true, quality: 'calculated' });
    }
    if (interestCost > 0) {
      subtotal += interestCost;
      steps.push({ label: 'Working capital interest', amount: interestCost, subtotal, category: 'finance', note: `${interestRate}% p.a. for ${financingDays} days on buy price`, editable: true, quality: 'calculated' });
    }
    if (insuranceCreditCost > 0) {
      subtotal += insuranceCreditCost;
      steps.push({ label: 'Credit insurance', amount: insuranceCreditCost, subtotal, category: 'finance', note: `${financing.creditInsurancePct}% of deal value`, editable: true, quality: 'calculated' });
    }

    financingResult = {
      totalFinancingCost,
      workingCapitalDays: financingDays,
      interestCost,
      lcCost,
      insuranceCost: insuranceCreditCost,
    };
  }

  const sellPrice = subtotal;
  steps.push({ label: '= Total Delivered Cost', amount: 0, subtotal: sellPrice, category: 'price', note: 'All-in cost including hedging and financing' });

  // ── INDEX COMPARISON ──
  // Derive the index price at the sell point from the CIF index
  let indexSellPrice: number | null = null;
  if (indexCifPrice && indexCifPrice > 0) {
    if (sellPoint === 'cif') {
      indexSellPrice = indexCifPrice;
    } else if (sellPoint === 'cfr') {
      // CFR = CIF minus insurance (approximate: insurance ~ 0.15% of CIF)
      indexSellPrice = indexCifPrice / (1 + INSURANCE_RATE);
    } else if (sellPoint === 'fob') {
      // FOB = CIF minus freight, discharge, insurance
      // Approximate: subtract the ocean costs we calculated
      const oceanCosts = freightPerTonne + DISCHARGE_FEES;
      const approxCfr = indexCifPrice / (1 + INSURANCE_RATE);
      indexSellPrice = approxCfr - oceanCosts;
    } else {
      // For other sell points we don't have a reliable index
      indexSellPrice = null;
    }
  }

  let margin: number | null = null;
  let marginPct: number | null = null;
  let totalProfit: number | null = null;
  let breakevenBuyPrice: number | null = null;

  if (indexSellPrice !== null && indexSellPrice > 0) {
    margin = indexSellPrice - sellPrice;
    marginPct = (margin / indexSellPrice) * 100;
    totalProfit = margin * volumeTonnes;
    const costsAboveBuy = sellPrice - buyPrice;
    breakevenBuyPrice = indexSellPrice - costsAboveBuy;

    const sellLabel = CORRIDOR_POINTS.find(p => p.key === sellPoint)?.label || sellPoint;
    steps.push({ label: `Index ${sellPoint.toUpperCase()} price`, amount: indexSellPrice, subtotal: indexSellPrice, category: 'price', note: `Market price at ${sellLabel}` });
    steps.push({ label: '= MARGIN', amount: 0, subtotal: margin, category: 'price', note: `${marginPct.toFixed(1)}% — ${margin >= 0 ? 'profitable' : 'LOSS'}` });
  }

  // ── ESTIMATED TIMELINE ──
  let estimatedDaysToDelivery = 0;
  if (isPositionActive('mine_to_stockpile') || isPositionActive('stockpile_to_portgate')) {
    estimatedDaysToDelivery += transportMode === 'rail' ? STAGE_DURATIONS.mine_to_port_rail : STAGE_DURATIONS.mine_to_port_road;
  }
  if (isPositionActive('stockpile_to_portgate') || isPositionActive('portgate_to_fob')) {
    estimatedDaysToDelivery += STAGE_DURATIONS.port_staging + (storageDays || 0);
  }
  if (isPositionActive('fob_to_cfr')) {
    estimatedDaysToDelivery += transitDays;
  }
  if (isPositionActive('fob_to_cfr') || isPositionActive('cfr_to_cif')) {
    estimatedDaysToDelivery += STAGE_DURATIONS.discharge_and_customs;
  }
  // Minimum 1 day for any deal
  if (estimatedDaysToDelivery === 0) estimatedDaysToDelivery = 1;

  // ── CORRIDOR VISUALIZATION ──
  // Fill in prices for corridor points that we didn't pass through
  // Set buy point price
  corridorPrices[buyPoint] = buyPrice;
  // Set sell point price
  corridorPrices[sellPoint] = sellPrice;

  const corridor: CorridorPoint[] = CORRIDOR_POINTS.map(cp => {
    const cpIdx = POINT_TO_START[cp.key];
    const isActive = cpIdx >= startIdx && cpIdx <= endIdx;
    return {
      point: cp.key,
      label: cp.label,
      price: round(corridorPrices[cp.key]),
      isActive,
    };
  });

  // ── Legacy field computation for backward compatibility ──
  // If the deal doesn't pass through a legacy price level, use 0
  const legacyMineGate = buyPoint === 'mine_gate' ? buyPrice : corridorPrices.mine_gate;
  const legacyFcaPort = corridorPrices.port_gate || corridorPrices.stockpile || 0;
  const legacyFob = corridorPrices.fob || 0;
  const legacyCif = corridorPrices.cif || sellPrice;

  return {
    buyPoint,
    sellPoint,
    buyPrice: round(buyPrice),
    sellPrice: round(sellPrice),
    indexSellPrice: indexSellPrice !== null ? round(indexSellPrice) : null,
    margin: margin !== null ? round(margin) : null,
    marginPct: marginPct !== null ? Math.round(marginPct * 10) / 10 : null,
    totalProfit: totalProfit !== null ? Math.round(totalProfit) : null,
    breakevenBuyPrice: breakevenBuyPrice !== null ? round(breakevenBuyPrice) : null,
    estimatedDaysToDelivery,
    steps: steps.map(s => ({ ...s, amount: round(s.amount), subtotal: round(s.subtotal) })),
    currency: 'USD',
    financing: financingResult,
    corridor,

    // Legacy fields
    mineGatePrice: round(legacyMineGate),
    fcaPortPrice: round(legacyFcaPort),
    fobPrice: round(legacyFob),
    cifPrice: round(legacyCif),
    totalDeliveredCost: round(sellPrice),
    indexCifPrice: indexCifPrice || null,
    breakevenMineGate: breakevenBuyPrice !== null ? round(breakevenBuyPrice) : null,
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

// Exported for testing
export { PORT_CHARGES, ROYALTY_RATES, INLAND_RATES, INSURANCE_RATE, SURVEY_SAMPLING, WEIGHBRIDGE, DISCHARGE_FEES, STAGE_DURATIONS };
