import type { GeoPoint, CommodityType } from './types';
import { calculateSeaRoute } from './sea-routes';
import { haversineDistance } from './distance';

export interface WaterfallStep {
  label: string;
  amount: number;       // $/t (negative = cost deducted)
  subtotal: number;     // running subtotal after this step
  category: 'price' | 'freight' | 'port' | 'tax' | 'inland' | 'other';
  note?: string;
  editable?: boolean;   // user can override this value
}

export interface PriceWaterfall {
  cifPrice: number;
  fobPrice: number;
  fcaPortPrice: number;
  fcaMineGatePrice: number;
  steps: WaterfallStep[];
  currency: string;
  margin?: { amount: number; percentage: number };
}

// SA Mineral Royalty Rate (MPRRA formula for unrefined minerals)
// Rate = 0.5 + (EBIT/gross_sales × 12.5)  capped at 7%
// Simplified: use effective rates by commodity
const ROYALTY_RATES: Record<string, number> = {
  chrome: 0.03,       // ~3% effective for chrome ore
  manganese: 0.03,    // ~3% for manganese ore
  iron_ore: 0.04,     // ~4% for iron ore (higher profitability)
  coal: 0.02,         // ~2% for thermal coal
  aggregates: 0.01,   // ~1% for aggregates
  platinum: 0.05,     // ~5% for PGMs (refined closer to 5%)
  gold: 0.05,         // ~5% for gold
  copper: 0.03,       // ~3%
  vanadium: 0.03,     // ~3%
  titanium: 0.03,     // ~3%
};

// Port charges (Transnet 2025/26 tariff book approx, ZAR → USD at ~18.5)
// Includes: handling, wharfage, stevedoring, crosshaul, agency, security, customs broker
const PORT_CHARGES: Record<string, {
  handling: number;        // Terminal handling
  wharfage: number;        // Port authority levy
  stevedoring: number;     // Loading onto vessel
  crosshaul: number;       // Stockpile to quayside
  agency: number;          // Port agent fees (per tonne, amortized from flat ~$4K per call)
  security: number;        // Port security levy
  customs_broker: number;  // Export declaration / clearing agent
  storage_per_week: number;
}> = {
  'Richards Bay':    { handling: 4.00, wharfage: 1.20, stevedoring: 3.00, crosshaul: 1.50, agency: 0.30, security: 0.10, customs_broker: 0.40, storage_per_week: 1.80 },
  'Saldanha Bay':    { handling: 3.80, wharfage: 1.10, stevedoring: 2.80, crosshaul: 1.20, agency: 0.30, security: 0.10, customs_broker: 0.40, storage_per_week: 1.50 },
  'Durban':          { handling: 4.50, wharfage: 1.40, stevedoring: 3.50, crosshaul: 2.00, agency: 0.35, security: 0.12, customs_broker: 0.45, storage_per_week: 2.00 },
  'Port Elizabeth':  { handling: 4.20, wharfage: 1.30, stevedoring: 3.20, crosshaul: 1.80, agency: 0.30, security: 0.10, customs_broker: 0.40, storage_per_week: 1.70 },
  'Maputo':          { handling: 5.00, wharfage: 1.60, stevedoring: 3.80, crosshaul: 2.20, agency: 0.50, security: 0.15, customs_broker: 0.60, storage_per_week: 2.20 },
  default:           { handling: 4.50, wharfage: 1.30, stevedoring: 3.20, crosshaul: 1.80, agency: 0.35, security: 0.10, customs_broker: 0.45, storage_per_week: 1.80 },
};

// Inland transport rates
const INLAND_RATES = {
  rail: {
    perTonneKm: 0.032,  // ~R0.60/t/km ÷ 18.5 = $0.032/t/km (Transnet bulk rate)
    fixedPerShipment: 200, // Wagon loading/offloading
  },
  road: {
    perTonneKm: 0.18,   // ~R3.30/t/km ÷ 18.5 = $0.18/t/km (30t side-tipper)
    fixedPerShipment: 50, // Weighbridge + loading
  },
};

// Fixed costs
const SURVEY_SAMPLING_PER_TONNE = 0.70;    // Surveyor + sampling at port
const INSURANCE_RATE = 0.0015;              // 0.15% of CIF value (marine cargo)
const WEIGHBRIDGE_PER_TONNE = 0.27;        // Per-truck weighbridge fee

// FX Hedging costs (SA perspective, based on interest rate differential)
// SARB repo rate ~7.75% vs Fed rate ~4.5% = ~3.25% annualized carry cost
// For 3-month forward: ~0.8% premium, 6-month: ~1.6%, 12-month: ~3.0%
export const FX_HEDGE_COSTS = {
  spot: { months: 0, annualizedPct: 0, label: 'No hedge (spot)' },
  forward_3m: { months: 3, annualizedPct: 3.25, label: '3-month FX forward' },
  forward_6m: { months: 6, annualizedPct: 3.25, label: '6-month FX forward' },
  forward_12m: { months: 12, annualizedPct: 3.25, label: '12-month FX forward' },
  option_3m: { months: 3, annualizedPct: 4.50, label: '3-month FX option (floor/ceiling)' },
  option_6m: { months: 6, annualizedPct: 5.00, label: '6-month FX option' },
  collar_3m: { months: 3, annualizedPct: 1.50, label: '3-month zero-cost collar' },
} as const;

export type FxHedgeType = keyof typeof FX_HEDGE_COSTS;

// Commodity price hedging (futures/swaps where available)
export const COMMODITY_HEDGE_COSTS: Record<string, {
  available: boolean;
  exchange: string;
  instrument: string;
  costPct: number; // annual cost as % of notional
  note: string;
}> = {
  iron_ore: { available: true, exchange: 'CME/SGX', instrument: '62% Fe futures', costPct: 0.5, note: 'Liquid market — SGX TSI Iron Ore 62% futures' },
  coal: { available: true, exchange: 'CME/ICE', instrument: 'API4 FOB RB futures', costPct: 0.5, note: 'Richards Bay FOB — ICE API4 contract' },
  gold: { available: true, exchange: 'CME/JSE', instrument: 'Gold futures', costPct: 0.3, note: 'Very liquid — CME COMEX or JSE' },
  platinum: { available: true, exchange: 'CME/JSE', instrument: 'Platinum futures', costPct: 0.5, note: 'CME NYMEX platinum futures' },
  copper: { available: true, exchange: 'LME/CME', instrument: 'Copper futures', costPct: 0.3, note: 'Very liquid — LME copper' },
  nickel: { available: true, exchange: 'LME', instrument: 'Nickel futures', costPct: 0.5, note: 'LME nickel (volatility higher)' },
  chrome: { available: false, exchange: 'OTC', instrument: 'Ferrochrome swaps', costPct: 1.5, note: 'No exchange-traded futures — OTC swaps via banks, less liquid' },
  manganese: { available: false, exchange: 'OTC', instrument: 'Mn ore swaps', costPct: 1.5, note: 'No exchange-traded futures — OTC swaps, thin market' },
  vanadium: { available: false, exchange: 'OTC', instrument: 'V2O5 swaps', costPct: 2.0, note: 'Very illiquid — OTC only, few counterparties' },
  titanium: { available: false, exchange: 'None', instrument: 'None', costPct: 0, note: 'No hedging instruments available — price risk unhedgeable' },
  aggregates: { available: false, exchange: 'None', instrument: 'None', costPct: 0, note: 'Domestic market — no hedging needed' },
};

export interface WaterfallParams {
  cifPrice: number;             // Known CIF index price ($/t)
  commodity: CommodityType;
  volumeTonnes: number;
  loadingPort: string;          // Port name
  loadingPortCoords: GeoPoint;
  destinationCoords: GeoPoint;  // CIF destination
  mineCoords?: GeoPoint;        // Mine location (for inland calc)
  mineName?: string;
  transportMode?: 'rail' | 'road';
  storageDays?: number;          // Days at port terminal before loading
  productionCost?: number;       // Optional: mine production cost ($/t)
  fxHedge?: FxHedgeType;         // FX hedging strategy
  hedgeCommodityPrice?: boolean; // Whether to hedge commodity price
  dealDurationMonths?: number;   // Deal duration for hedge cost calculation
  dealCurrency?: string;         // USD, ZAR, EUR
}

export function calculatePriceWaterfall(params: WaterfallParams): PriceWaterfall {
  const {
    cifPrice, commodity, volumeTonnes, loadingPort, loadingPortCoords,
    destinationCoords, mineCoords, transportMode = 'rail',
    storageDays = 0, productionCost,
    fxHedge = 'spot', hedgeCommodityPrice = false,
    dealDurationMonths = 3, dealCurrency = 'USD',
  } = params;

  const steps: WaterfallStep[] = [];
  let subtotal = cifPrice;

  // Step 1: CIF Price
  steps.push({
    label: 'CIF Price (index)',
    amount: cifPrice,
    subtotal,
    category: 'price',
    note: 'Published index or negotiated price at destination port',
  });

  // Step 2: Deduct marine insurance
  const insuranceCost = cifPrice * INSURANCE_RATE;
  subtotal -= insuranceCost;
  steps.push({
    label: 'Marine insurance',
    amount: -insuranceCost,
    subtotal,
    category: 'freight',
    note: `${(INSURANCE_RATE * 100).toFixed(2)}% of CIF value`,
    editable: true,
  });

  // Step 3: Deduct ocean freight
  let freightPerTonne = 0;
  try {
    const route = calculateSeaRoute(loadingPortCoords, destinationCoords, volumeTonnes);
    freightPerTonne = route.freightRatePerTonne;
  } catch {
    // Fallback estimate
    const distNm = haversineDistance(
      loadingPortCoords.lat, loadingPortCoords.lng,
      destinationCoords.lat, destinationCoords.lng
    ) * 1.4;
    freightPerTonne = distNm * 0.002; // rough $/nm/t
  }
  subtotal -= freightPerTonne;
  steps.push({
    label: 'Ocean freight',
    amount: -freightPerTonne,
    subtotal,
    category: 'freight',
    note: `${loadingPort} → destination (includes bunker, hire, canal fees)`,
    editable: true,
  });

  // Discharge port fees (buyer-side but included in CIF)
  const dischargeFees = 4.50; // Typical discharge port handling $/t
  subtotal -= dischargeFees;
  steps.push({
    label: 'Discharge port fees',
    amount: -dischargeFees,
    subtotal,
    category: 'freight',
    note: 'Destination port handling, wharfage, stevedoring',
    editable: true,
  });

  const fobPrice = subtotal;

  // Step 4: FOB marker
  steps.push({
    label: '= FOB Price',
    amount: 0,
    subtotal: fobPrice,
    category: 'price',
    note: `Free On Board at ${loadingPort}`,
  });

  // Port costs — all charges between FOB and FCA Port Gate
  const portCharges = PORT_CHARGES[loadingPort] || PORT_CHARGES.default;

  // Stevedoring (loading cargo onto vessel)
  subtotal -= portCharges.stevedoring;
  steps.push({
    label: 'Stevedoring',
    amount: -portCharges.stevedoring,
    subtotal,
    category: 'port',
    note: 'Loading cargo onto vessel (grab/conveyor)',
    editable: true,
  });

  // Crosshaul (moving from stockpile to quayside)
  subtotal -= portCharges.crosshaul;
  steps.push({
    label: 'Crosshaul',
    amount: -portCharges.crosshaul,
    subtotal,
    category: 'port',
    note: 'Transport from stockpile to ship-side at terminal',
    editable: true,
  });

  // Terminal handling
  subtotal -= portCharges.handling;
  steps.push({
    label: 'Terminal handling',
    amount: -portCharges.handling,
    subtotal,
    category: 'port',
    note: `${loadingPort} terminal handling charges (TPT)`,
    editable: true,
  });

  // Wharfage
  subtotal -= portCharges.wharfage;
  steps.push({
    label: 'Wharfage',
    amount: -portCharges.wharfage,
    subtotal,
    category: 'port',
    note: 'Transnet National Ports Authority wharfage levy',
    editable: true,
  });

  // Port agency fees
  subtotal -= portCharges.agency;
  steps.push({
    label: 'Port agency',
    amount: -portCharges.agency,
    subtotal,
    category: 'port',
    note: 'Ship agent fees (amortized from ~$4K flat per vessel call)',
    editable: true,
  });

  // Port security levy
  subtotal -= portCharges.security;
  steps.push({
    label: 'Port security',
    amount: -portCharges.security,
    subtotal,
    category: 'port',
    note: 'ISPS port security levy',
  });

  // Customs broker / clearing agent
  subtotal -= portCharges.customs_broker;
  steps.push({
    label: 'Customs broker',
    amount: -portCharges.customs_broker,
    subtotal,
    category: 'port',
    note: 'Export declaration (SAD500) filing and clearing agent fees',
    editable: true,
  });

  // Export royalty (MPRRA)
  const royaltyRate = ROYALTY_RATES[commodity] || 0.03;
  const royaltyCost = fobPrice * royaltyRate;
  subtotal -= royaltyCost;
  steps.push({
    label: 'Mineral royalty',
    amount: -royaltyCost,
    subtotal,
    category: 'tax',
    note: `MPRRA ~${(royaltyRate * 100).toFixed(1)}% of FOB (effective rate for ${commodity})`,
    editable: true,
  });

  // Surveyor / sampling / inspection
  subtotal -= SURVEY_SAMPLING_PER_TONNE;
  steps.push({
    label: 'Surveyor & sampling',
    amount: -SURVEY_SAMPLING_PER_TONNE,
    subtotal,
    category: 'port',
    note: 'Independent inspection, sampling, and draft survey at port',
  });

  // Step 9: Terminal storage (if applicable)
  if (storageDays > 0) {
    const storageWeeks = Math.ceil(storageDays / 7);
    const storageCost = storageWeeks * portCharges.storage_per_week;
    subtotal -= storageCost;
    steps.push({
      label: 'Terminal storage',
      amount: -storageCost,
      subtotal,
      category: 'port',
      note: `${storageDays} days (${storageWeeks} weeks) at ${loadingPort}`,
      editable: true,
    });
  }

  const fcaPortPrice = subtotal;

  // Step 10: FCA Port marker
  steps.push({
    label: '= FCA Port Gate',
    amount: 0,
    subtotal: fcaPortPrice,
    category: 'price',
    note: `Free Carrier at ${loadingPort} gate`,
  });

  // Step 11: Inland transport (if mine coordinates provided)
  let inlandCost = 0;
  if (mineCoords) {
    const inlandDistKm = haversineDistance(
      mineCoords.lat, mineCoords.lng,
      loadingPortCoords.lat, loadingPortCoords.lng
    ) * 1.852 * 1.3; // Convert nm to km, add 30% for road/rail detour

    const rates = INLAND_RATES[transportMode];
    inlandCost = (inlandDistKm * rates.perTonneKm) + (rates.fixedPerShipment / volumeTonnes);

    subtotal -= inlandCost;
    steps.push({
      label: `Inland ${transportMode} freight`,
      amount: -inlandCost,
      subtotal,
      category: 'inland',
      note: `${Math.round(inlandDistKm)}km by ${transportMode}${params.mineName ? ` from ${params.mineName}` : ''}`,
      editable: true,
    });

    // Step 12: Weighbridge
    subtotal -= WEIGHBRIDGE_PER_TONNE;
    steps.push({
      label: 'Weighbridge',
      amount: -WEIGHBRIDGE_PER_TONNE,
      subtotal,
      category: 'inland',
      note: 'Per-truck weighbridge at mine',
    });
  }

  const fcaMineGatePrice = subtotal;

  // Step 13: Mine Gate marker
  steps.push({
    label: '= FCA Mine Gate (EXW)',
    amount: 0,
    subtotal: fcaMineGatePrice,
    category: 'price',
    note: 'Ex-Works price at mine gate',
  });

  // --- HEDGING COSTS ---

  // FX Hedging (relevant when deal is in ZAR but settled in USD, or vice versa)
  const fxHedgeConfig = FX_HEDGE_COSTS[fxHedge];
  if (fxHedge !== 'spot' && dealCurrency !== 'USD') {
    const hedgeDurationMonths = Math.min(fxHedgeConfig.months, dealDurationMonths);
    const fxHedgeCost = cifPrice * (fxHedgeConfig.annualizedPct / 100) * (hedgeDurationMonths / 12);
    subtotal -= fxHedgeCost;
    steps.push({
      label: `FX hedge (${fxHedgeConfig.label})`,
      amount: -fxHedgeCost,
      subtotal,
      category: 'other',
      note: `${fxHedgeConfig.annualizedPct}% p.a. × ${hedgeDurationMonths}m — USD/ZAR interest rate differential`,
      editable: true,
    });
  } else if (fxHedge === 'spot' && dealCurrency !== 'USD') {
    steps.push({
      label: 'FX exposure (unhedged)',
      amount: 0,
      subtotal,
      category: 'other',
      note: `⚠ ${dealCurrency}/USD unhedged — exposed to ~15% annual ZAR volatility`,
    });
  }

  // Commodity Price Hedging
  const commodityHedge = COMMODITY_HEDGE_COSTS[commodity];
  if (hedgeCommodityPrice && commodityHedge) {
    if (commodityHedge.available) {
      const hedgeCost = cifPrice * (commodityHedge.costPct / 100) * (dealDurationMonths / 12);
      subtotal -= hedgeCost;
      steps.push({
        label: `Price hedge (${commodityHedge.instrument})`,
        amount: -hedgeCost,
        subtotal,
        category: 'other',
        note: `${commodityHedge.exchange} — ${commodityHedge.costPct}% p.a. × ${dealDurationMonths}m. ${commodityHedge.note}`,
        editable: true,
      });
    } else {
      steps.push({
        label: `Price hedge (${commodityHedge.instrument || 'unavailable'})`,
        amount: 0,
        subtotal,
        category: 'other',
        note: `⚠ ${commodityHedge.note}`,
      });
    }
  }

  // Update mine gate price after hedging costs
  const fcaMineGateAfterHedge = subtotal;

  // Step 14: Margin (if production cost provided)
  let margin;
  if (productionCost !== undefined && productionCost > 0) {
    const marginAmount = fcaMineGatePrice - productionCost;
    const marginPct = (marginAmount / fcaMineGatePrice) * 100;
    margin = { amount: marginAmount, percentage: marginPct };
    steps.push({
      label: 'Production cost',
      amount: -productionCost,
      subtotal: marginAmount,
      category: 'other',
      note: 'Estimated mine production cost',
      editable: true,
    });
    steps.push({
      label: '= Margin',
      amount: 0,
      subtotal: marginAmount,
      category: 'price',
      note: `${marginPct.toFixed(1)}% margin`,
    });
  }

  return {
    cifPrice,
    fobPrice: Math.round(fobPrice * 100) / 100,
    fcaPortPrice: Math.round(fcaPortPrice * 100) / 100,
    fcaMineGatePrice: Math.round(fcaMineGatePrice * 100) / 100,
    steps: steps.map(s => ({ ...s, amount: Math.round(s.amount * 100) / 100, subtotal: Math.round(s.subtotal * 100) / 100 })),
    currency: 'USD',
    margin,
  };
}

// Exported for testing
export { ROYALTY_RATES, PORT_CHARGES, INLAND_RATES, INSURANCE_RATE, SURVEY_SAMPLING_PER_TONNE, WEIGHBRIDGE_PER_TONNE };
