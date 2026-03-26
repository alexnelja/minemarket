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

// Port handling charges (Transnet 2025/26 tariff book approximations, ZAR → USD at ~18.5)
const PORT_CHARGES: Record<string, { handling: number; wharfage: number; storage_per_week: number }> = {
  'Richards Bay':    { handling: 4.00, wharfage: 1.20, storage_per_week: 1.80 },
  'Saldanha Bay':    { handling: 3.80, wharfage: 1.10, storage_per_week: 1.50 },
  'Durban':          { handling: 4.50, wharfage: 1.40, storage_per_week: 2.00 },
  'Port Elizabeth':  { handling: 4.20, wharfage: 1.30, storage_per_week: 1.70 },
  'Maputo':          { handling: 5.00, wharfage: 1.60, storage_per_week: 2.20 },
  default:           { handling: 4.50, wharfage: 1.30, storage_per_week: 1.80 },
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
}

export function calculatePriceWaterfall(params: WaterfallParams): PriceWaterfall {
  const {
    cifPrice, commodity, volumeTonnes, loadingPort, loadingPortCoords,
    destinationCoords, mineCoords, transportMode = 'rail',
    storageDays = 0, productionCost,
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
    note: `${loadingPort} → destination`,
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

  // Step 5: Port handling
  const portCharges = PORT_CHARGES[loadingPort] || PORT_CHARGES.default;
  subtotal -= portCharges.handling;
  steps.push({
    label: 'Port handling',
    amount: -portCharges.handling,
    subtotal,
    category: 'port',
    note: `${loadingPort} terminal handling charges`,
    editable: true,
  });

  // Step 6: Wharfage
  subtotal -= portCharges.wharfage;
  steps.push({
    label: 'Wharfage',
    amount: -portCharges.wharfage,
    subtotal,
    category: 'port',
    note: 'Transnet port authority wharfage levy',
    editable: true,
  });

  // Step 7: Export royalty
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

  // Step 8: Surveyor / sampling
  subtotal -= SURVEY_SAMPLING_PER_TONNE;
  steps.push({
    label: 'Surveyor & sampling',
    amount: -SURVEY_SAMPLING_PER_TONNE,
    subtotal,
    category: 'port',
    note: 'Independent inspection and sampling at port',
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
