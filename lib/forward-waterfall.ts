import type { GeoPoint, CommodityType } from './types';
import { calculateSeaRoute } from './sea-routes';
import { haversineDistance } from './distance';
import {
  FX_HEDGE_COSTS, COMMODITY_HEDGE_COSTS, type FxHedgeType,
} from './price-waterfall';

export interface ForwardWaterfallStep {
  label: string;
  amount: number;       // $/t (positive = cost added)
  subtotal: number;     // running subtotal
  category: 'cost' | 'freight' | 'port' | 'tax' | 'inland' | 'finance' | 'price';
  note?: string;
  editable?: boolean;
}

export interface TradeFinancing {
  lcCostPct?: number;        // Letter of credit cost as % of deal value (0.5-1.5%)
  interestRatePct?: number;  // Working capital interest rate (SA prime ~11.5%)
  financingDays?: number;    // Days of financing needed (mine purchase to payment receipt)
  creditInsurancePct?: number; // Credit insurance (0.3-0.8%)
}

export interface DealSimulation {
  mineGatePrice: number;
  fcaPortPrice: number;
  fobPrice: number;
  cifPrice: number;
  totalDeliveredCost: number;
  indexCifPrice: number | null;
  margin: number | null;
  marginPct: number | null;
  totalProfit: number | null;
  breakevenMineGate: number | null;
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
}

// Port charges (same data as price-waterfall.ts)
const PORT_CHARGES: Record<string, {
  handling: number; wharfage: number; stevedoring: number; crosshaul: number;
  agency: number; security: number; customs_broker: number; storage_per_week: number;
}> = {
  'Richards Bay':    { handling: 4.00, wharfage: 1.20, stevedoring: 3.00, crosshaul: 1.50, agency: 0.30, security: 0.10, customs_broker: 0.40, storage_per_week: 1.80 },
  'Saldanha Bay':    { handling: 3.80, wharfage: 1.10, stevedoring: 2.80, crosshaul: 1.20, agency: 0.30, security: 0.10, customs_broker: 0.40, storage_per_week: 1.50 },
  'Durban':          { handling: 4.50, wharfage: 1.40, stevedoring: 3.50, crosshaul: 2.00, agency: 0.35, security: 0.12, customs_broker: 0.45, storage_per_week: 2.00 },
  'Port Elizabeth':  { handling: 4.20, wharfage: 1.30, stevedoring: 3.20, crosshaul: 1.80, agency: 0.30, security: 0.10, customs_broker: 0.40, storage_per_week: 1.70 },
  'Maputo':          { handling: 5.00, wharfage: 1.60, stevedoring: 3.80, crosshaul: 2.20, agency: 0.50, security: 0.15, customs_broker: 0.60, storage_per_week: 2.20 },
  default:           { handling: 4.50, wharfage: 1.30, stevedoring: 3.20, crosshaul: 1.80, agency: 0.35, security: 0.10, customs_broker: 0.45, storage_per_week: 1.80 },
};

const ROYALTY_RATES: Record<string, number> = {
  chrome: 0.03, manganese: 0.03, iron_ore: 0.04, coal: 0.02, aggregates: 0.01,
  platinum: 0.05, gold: 0.05, copper: 0.03, vanadium: 0.03, titanium: 0.03,
};

const INLAND_RATES = {
  rail: { perTonneKm: 0.032, fixedPerShipment: 200 },
  road: { perTonneKm: 0.18, fixedPerShipment: 50 },
};

const INSURANCE_RATE = 0.0015;
const SURVEY_SAMPLING = 0.70;
const WEIGHBRIDGE = 0.27;
const DISCHARGE_FEES = 4.50;

// Estimated timeline by stage (days)
const STAGE_DURATIONS = {
  mine_to_port_rail: 3,
  mine_to_port_road: 2,
  port_staging: 5,
  ocean_transit_per_1000nm: 3.2,
  discharge_and_customs: 5,
  payment_after_delivery: 14,
};

export interface SimulationParams {
  mineGatePrice: number;
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
  indexCifPrice?: number;
  financing?: TradeFinancing;
}

export function simulateDeal(params: SimulationParams): DealSimulation {
  const {
    mineGatePrice, commodity, volumeTonnes, loadingPort, loadingPortCoords,
    destinationCoords, destinationName, mineCoords, mineName,
    transportMode = 'rail', storageDays = 0,
    fxHedge = 'spot', hedgeCommodityPrice = false,
    dealCurrency = 'USD', dealDurationMonths = 3,
    indexCifPrice, financing,
  } = params;

  const steps: ForwardWaterfallStep[] = [];
  let subtotal = mineGatePrice;

  // === MINE GATE ===
  steps.push({
    label: 'Mine gate price (EXW)',
    amount: mineGatePrice,
    subtotal,
    category: 'price',
    note: mineName ? `Purchase at ${mineName}` : 'Ex-works price at mine',
    editable: true,
  });

  // Weighbridge
  subtotal += WEIGHBRIDGE;
  steps.push({ label: 'Weighbridge', amount: WEIGHBRIDGE, subtotal, category: 'inland', note: 'Per-truck weighbridge at mine' });

  // === INLAND TRANSPORT ===
  let inlandDistKm = 0;
  if (mineCoords) {
    inlandDistKm = haversineDistance(mineCoords.lat, mineCoords.lng, loadingPortCoords.lat, loadingPortCoords.lng) * 1.852 * 1.3;
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
    });
  }

  const fcaPortPrice = subtotal;
  steps.push({ label: '= FCA Port Gate', amount: 0, subtotal: fcaPortPrice, category: 'price', note: `Delivered to ${loadingPort} gate` });

  // === PORT COSTS ===
  const port = PORT_CHARGES[loadingPort] || PORT_CHARGES.default;

  const portCosts = [
    { label: 'Stevedoring', amount: port.stevedoring, note: 'Loading cargo onto vessel' },
    { label: 'Crosshaul', amount: port.crosshaul, note: 'Stockpile to quayside' },
    { label: 'Terminal handling', amount: port.handling, note: `${loadingPort} TPT charges` },
    { label: 'Wharfage', amount: port.wharfage, note: 'TNPA wharfage levy' },
    { label: 'Port agency', amount: port.agency, note: 'Ship agent fees' },
    { label: 'Port security', amount: port.security, note: 'ISPS levy' },
    { label: 'Customs broker', amount: port.customs_broker, note: 'SAD500 filing + clearing' },
  ];

  for (const cost of portCosts) {
    subtotal += cost.amount;
    steps.push({ label: cost.label, amount: cost.amount, subtotal, category: 'port', note: cost.note, editable: true });
  }

  // Royalty (on FOB value — circular, so approximate on current subtotal)
  const royaltyRate = ROYALTY_RATES[commodity] || 0.03;
  const royaltyCost = subtotal * royaltyRate;
  subtotal += royaltyCost;
  steps.push({ label: 'Mineral royalty', amount: royaltyCost, subtotal, category: 'tax', note: `MPRRA ~${(royaltyRate * 100).toFixed(1)}% of FOB`, editable: true });

  // Surveyor
  subtotal += SURVEY_SAMPLING;
  steps.push({ label: 'Surveyor & sampling', amount: SURVEY_SAMPLING, subtotal, category: 'port', note: 'Independent inspection at port' });

  // Storage
  if (storageDays > 0) {
    const storageWeeks = Math.ceil(storageDays / 7);
    const storageCost = storageWeeks * port.storage_per_week;
    subtotal += storageCost;
    steps.push({ label: 'Terminal storage', amount: storageCost, subtotal, category: 'port', note: `${storageDays} days at ${loadingPort}`, editable: true });
  }

  const fobPrice = subtotal;
  steps.push({ label: '= FOB Price', amount: 0, subtotal: fobPrice, category: 'price', note: `Free On Board at ${loadingPort}` });

  // === OCEAN FREIGHT ===
  let freightPerTonne = 0;
  let transitDays = 0;
  let routeDistanceNm = 0;
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

  subtotal += freightPerTonne;
  steps.push({ label: 'Ocean freight', amount: freightPerTonne, subtotal, category: 'freight', note: `${loadingPort} → ${destinationName || 'destination'} (${Math.round(routeDistanceNm).toLocaleString()} nm)`, editable: true });

  // Insurance
  const insuranceCost = subtotal * INSURANCE_RATE;
  subtotal += insuranceCost;
  steps.push({ label: 'Marine insurance', amount: insuranceCost, subtotal, category: 'freight', note: `${(INSURANCE_RATE * 100).toFixed(2)}% of cargo value` });

  // Discharge
  subtotal += DISCHARGE_FEES;
  steps.push({ label: 'Discharge port fees', amount: DISCHARGE_FEES, subtotal, category: 'freight', note: 'Destination port handling + stevedoring' });

  const cifPrice = subtotal;
  steps.push({ label: '= CIF Price (delivered)', amount: 0, subtotal: cifPrice, category: 'price', note: `Cost, Insurance & Freight at ${destinationName || 'destination'}` });

  // === HEDGING COSTS ===
  const fxHedgeConfig = FX_HEDGE_COSTS[fxHedge];
  if (fxHedge !== 'spot' && dealCurrency !== 'USD') {
    const hedgeDuration = Math.min(fxHedgeConfig.months, dealDurationMonths);
    const fxCost = cifPrice * (fxHedgeConfig.annualizedPct / 100) * (hedgeDuration / 12);
    subtotal += fxCost;
    steps.push({ label: `FX hedge (${fxHedgeConfig.label})`, amount: fxCost, subtotal, category: 'finance', note: `${fxHedgeConfig.annualizedPct}% p.a. × ${hedgeDuration}m`, editable: true });
  }

  if (hedgeCommodityPrice) {
    const hedge = COMMODITY_HEDGE_COSTS[commodity];
    if (hedge?.available) {
      const hedgeCost = cifPrice * (hedge.costPct / 100) * (dealDurationMonths / 12);
      subtotal += hedgeCost;
      steps.push({ label: `Price hedge (${hedge.instrument})`, amount: hedgeCost, subtotal, category: 'finance', note: `${hedge.exchange} — ${hedge.costPct}% p.a.`, editable: true });
    }
  }

  // === TRADE FINANCING ===
  let financingResult = null;
  if (financing) {
    const dealValue = cifPrice * volumeTonnes;
    const lcCost = financing.lcCostPct ? dealValue * (financing.lcCostPct / 100) / volumeTonnes : 0;
    const financingDays = financing.financingDays || (transitDays + STAGE_DURATIONS.mine_to_port_rail + STAGE_DURATIONS.port_staging + STAGE_DURATIONS.discharge_and_customs + STAGE_DURATIONS.payment_after_delivery);
    const interestRate = financing.interestRatePct || 11.5;
    const interestCost = (mineGatePrice * volumeTonnes) * (interestRate / 100) * (financingDays / 365) / volumeTonnes;
    const insuranceCreditCost = financing.creditInsurancePct ? dealValue * (financing.creditInsurancePct / 100) / volumeTonnes : 0;
    const totalFinancingCost = lcCost + interestCost + insuranceCreditCost;

    if (lcCost > 0) {
      subtotal += lcCost;
      steps.push({ label: 'Letter of credit', amount: lcCost, subtotal, category: 'finance', note: `${financing.lcCostPct}% of deal value`, editable: true });
    }
    if (interestCost > 0) {
      subtotal += interestCost;
      steps.push({ label: 'Working capital interest', amount: interestCost, subtotal, category: 'finance', note: `${interestRate}% p.a. for ${financingDays} days on mine purchase`, editable: true });
    }
    if (insuranceCreditCost > 0) {
      subtotal += insuranceCreditCost;
      steps.push({ label: 'Credit insurance', amount: insuranceCreditCost, subtotal, category: 'finance', note: `${financing.creditInsurancePct}% of deal value`, editable: true });
    }

    financingResult = {
      totalFinancingCost,
      workingCapitalDays: financingDays,
      interestCost,
      lcCost,
      insuranceCost: insuranceCreditCost,
    };
  }

  const totalDeliveredCost = subtotal;
  steps.push({ label: '= Total Delivered Cost', amount: 0, subtotal: totalDeliveredCost, category: 'price', note: 'All-in cost including hedging and financing' });

  // === MARGIN vs INDEX ===
  let margin = null;
  let marginPct = null;
  let totalProfit = null;
  let breakevenMineGate = null;

  if (indexCifPrice && indexCifPrice > 0) {
    margin = indexCifPrice - totalDeliveredCost;
    marginPct = (margin / indexCifPrice) * 100;
    totalProfit = margin * volumeTonnes;
    const allCostsAboveMineGate = totalDeliveredCost - mineGatePrice;
    breakevenMineGate = indexCifPrice - allCostsAboveMineGate;

    steps.push({ label: 'Index CIF price', amount: indexCifPrice, subtotal: indexCifPrice, category: 'price', note: 'Current market price at destination' });
    steps.push({ label: '= MARGIN', amount: 0, subtotal: margin, category: 'price', note: `${marginPct.toFixed(1)}% — ${margin >= 0 ? 'profitable' : 'LOSS'}` });
  }

  // === ESTIMATED TIMELINE ===
  const inlandDays = transportMode === 'rail' ? STAGE_DURATIONS.mine_to_port_rail : STAGE_DURATIONS.mine_to_port_road;
  const portDays = STAGE_DURATIONS.port_staging + (storageDays || 0);
  const dischargeDays = STAGE_DURATIONS.discharge_and_customs;
  const estimatedDaysToDelivery = inlandDays + portDays + transitDays + dischargeDays;

  return {
    mineGatePrice: round(mineGatePrice),
    fcaPortPrice: round(fcaPortPrice),
    fobPrice: round(fobPrice),
    cifPrice: round(cifPrice),
    totalDeliveredCost: round(totalDeliveredCost),
    indexCifPrice: indexCifPrice || null,
    margin: margin !== null ? round(margin) : null,
    marginPct: marginPct !== null ? Math.round(marginPct * 10) / 10 : null,
    totalProfit: totalProfit !== null ? Math.round(totalProfit) : null,
    breakevenMineGate: breakevenMineGate !== null ? round(breakevenMineGate) : null,
    estimatedDaysToDelivery,
    steps: steps.map(s => ({ ...s, amount: round(s.amount), subtotal: round(s.subtotal) })),
    currency: 'USD',
    financing: financingResult,
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

// Exported for testing
export { PORT_CHARGES, ROYALTY_RATES, INLAND_RATES, INSURANCE_RATE, SURVEY_SAMPLING, WEIGHBRIDGE, DISCHARGE_FEES, STAGE_DURATIONS };
