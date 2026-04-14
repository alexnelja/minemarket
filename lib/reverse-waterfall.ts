/**
 * Reverse Waterfall: Start from sell price, subtract costs backwards to find breakeven buy price.
 *
 * This is the core calculation for the redesigned simulator.
 * Forward waterfall: buy price → add costs → sell price
 * Reverse waterfall: sell price → subtract costs → breakeven buy price
 */
import type { GeoPoint, CommodityType } from './types';
import { calculateSeaRoute } from './sea-routes';
import { haversineDistance } from './distance';
import { FX_HEDGE_COSTS, COMMODITY_HEDGE_COSTS, type FxHedgeType } from './price-waterfall';
import type { DataQuality } from './data-sources';
import type { TradePoint } from './forward-waterfall';
import { POINT_TO_START, POINT_TO_END } from './forward-waterfall';
import {
  PORT_CHARGES, ROYALTY_RATES, INLAND_RATES,
  INSURANCE_RATE, SURVEY_SAMPLING, WEIGHBRIDGE, DISCHARGE_FEES,
} from './shipping-constants';

// ── Interfaces ─────────────────────────────────────────────────────────────

export interface ReverseWaterfallResult {
  sellPoint: TradePoint;
  buyPoint: TradePoint;
  sellPrice: number;             // Input: what the buyer pays you
  breakevenBuyPrice: number;     // Output: max you can pay at the mine
  totalCosts: number;            // Sum of all costs between buy and sell points
  margin: number | null;         // sellPrice - (breakevenBuyPrice + totalCosts) — null if no index
  marginPct: number | null;
  steps: ReverseStep[];          // Each cost item, ordered sell → buy
  corridorPrices: Record<TradePoint, number>; // Price at each point working backwards
}

export interface ReverseStep {
  label: string;
  amount: number;       // Positive = cost deducted from sell price
  runningPrice: number; // Remaining price after deducting this cost
  category: 'cost' | 'freight' | 'port' | 'tax' | 'inland' | 'finance';
  note?: string;
  editable?: boolean;
  sourceId?: string;
  quality?: DataQuality;
}

export interface ReverseWaterfallParams {
  sellPrice: number;             // $/t at sell point
  sellPoint: TradePoint;
  buyPoint: TradePoint;
  commodity: CommodityType;
  volumeTonnes: number;
  loadingPort: string;
  loadingPortCoords: GeoPoint;
  destinationCoords?: GeoPoint;
  destinationName?: string;
  mineCoords?: GeoPoint;
  mineName?: string;
  transportMode?: 'rail' | 'road';
  storageDays?: number;
  fxHedge?: FxHedgeType;
  hedgeCommodityPrice?: boolean;
  dealDurationMonths?: number;
  grade?: number;
  overrides?: Record<string, number>; // Manual cost overrides by step key
}

// ── Verification checkpoints ───────────────────────────────────────────────

export interface VerificationCheckpoint {
  point: TradePoint;
  type: 'weighbridge' | 'sampling' | 'lab_assay' | 'draft_survey' | 'tally' | 'customs_inspection';
  label: string;
  description: string;
  required: boolean;
  estimatedCost: number;  // $/t
  estimatedDays: number;
  verifiedBy: 'seller' | 'buyer' | 'independent' | 'government';
}

export function getVerificationCheckpoints(
  buyPoint: TradePoint,
  sellPoint: TradePoint,
  commodity: CommodityType,
): VerificationCheckpoint[] {
  const checkpoints: VerificationCheckpoint[] = [];

  const buyIdx = POINT_TO_START[buyPoint];
  const sellIdx = POINT_TO_START[sellPoint];

  // Mine gate — weighbridge + sampling
  if (buyIdx <= 0 && sellIdx > 0) {
    checkpoints.push({
      point: 'mine_gate',
      type: 'weighbridge',
      label: 'Mine Weighbridge',
      description: 'Weigh each truck at mine gate. Tonnage recorded for invoicing.',
      required: true,
      estimatedCost: 0.27,
      estimatedDays: 0,
      verifiedBy: 'seller',
    });
    checkpoints.push({
      point: 'mine_gate',
      type: 'sampling',
      label: 'Mine Sampling',
      description: 'Representative sample taken per lot for grade verification.',
      required: true,
      estimatedCost: 0.35,
      estimatedDays: 0,
      verifiedBy: 'seller',
    });
  }

  // Stockpile — lab assay (independent)
  if (buyIdx <= 1 && sellIdx > 1) {
    checkpoints.push({
      point: 'stockpile',
      type: 'lab_assay',
      label: 'Independent Lab Assay',
      description: `Grade verification at port stockpile. Tests ${commodity === 'chrome' ? 'Cr₂O₃, SiO₂, Fe₂O₃' : commodity === 'manganese' ? 'Mn, Fe, SiO₂, P' : 'grade and impurities'}.`,
      required: true,
      estimatedCost: 0.70,
      estimatedDays: 2,
      verifiedBy: 'independent',
    });
  }

  // FOB — draft survey + tally
  if (buyIdx <= 3 && sellIdx >= 3) {
    checkpoints.push({
      point: 'fob',
      type: 'draft_survey',
      label: 'Draft Survey',
      description: 'Independent surveyor measures vessel displacement before/after loading to verify tonnage.',
      required: true,
      estimatedCost: 0.40,
      estimatedDays: 0.5,
      verifiedBy: 'independent',
    });
    checkpoints.push({
      point: 'fob',
      type: 'tally',
      label: 'Loading Tally',
      description: 'Count and record each grab/pour loaded. Reconcile with weighbridge totals.',
      required: false,
      estimatedCost: 0.15,
      estimatedDays: 0,
      verifiedBy: 'independent',
    });
  }

  // Port gate — customs inspection
  if (buyIdx <= 2 && sellIdx > 2) {
    checkpoints.push({
      point: 'port_gate',
      type: 'customs_inspection',
      label: 'Export Customs (SARS)',
      description: 'SAD500 declaration. Random physical inspection by SARS.',
      required: true,
      estimatedCost: 0,
      estimatedDays: 1,
      verifiedBy: 'government',
    });
  }

  // CIF — discharge survey
  if (sellIdx >= 5) {
    checkpoints.push({
      point: 'cif',
      type: 'draft_survey',
      label: 'Discharge Draft Survey',
      description: 'Independent surveyor at destination port verifies delivered tonnage.',
      required: true,
      estimatedCost: 0.40,
      estimatedDays: 0.5,
      verifiedBy: 'independent',
    });
    checkpoints.push({
      point: 'cif',
      type: 'lab_assay',
      label: 'Destination Lab Assay',
      description: 'Buyer\'s independent lab tests delivered material against contract specs.',
      required: true,
      estimatedCost: 0.50,
      estimatedDays: 3,
      verifiedBy: 'buyer',
    });
  }

  return checkpoints;
}

// Cost constants imported from lib/shipping-constants.ts (single source of truth)

// ── Reverse waterfall function ─────────────────────────────────────────────

export function reverseWaterfall(params: ReverseWaterfallParams): ReverseWaterfallResult {
  const {
    sellPrice, sellPoint, buyPoint, commodity, volumeTonnes,
    loadingPort, loadingPortCoords, destinationCoords, destinationName,
    mineCoords, transportMode = 'rail',
    fxHedge = 'spot', hedgeCommodityPrice = false,
    dealDurationMonths = 3, overrides,
  } = params;

  const startIdx = POINT_TO_START[buyPoint];
  const endIdx = POINT_TO_END[sellPoint];

  function isActive(pos: string, posIdx: number): boolean {
    return posIdx >= startIdx && posIdx < endIdx;
  }

  function override(key: string, calculated: number): number {
    if (overrides && overrides[key] !== undefined && overrides[key] >= 0) {
      return overrides[key];
    }
    return calculated;
  }

  const steps: ReverseStep[] = [];
  let price = sellPrice;

  const corridorPrices: Record<TradePoint, number> = {
    mine_gate: 0, stockpile: 0, port_gate: 0, fob: 0, cfr: 0, cif: 0,
  };
  corridorPrices[sellPoint] = sellPrice;

  // Work backwards: CIF → CFR → FOB → port_gate → stockpile → mine_gate

  // ── CIF → CFR (insurance) ──
  if (isActive('cfr_to_cif', 4)) {
    const insurance = override('insurance', price * INSURANCE_RATE);
    price -= insurance;
    steps.push({
      label: 'Marine insurance',
      amount: insurance,
      runningPrice: price,
      category: 'cost',
      note: `${(INSURANCE_RATE * 100).toFixed(2)}% of CIF value`,
      editable: true,
      sourceId: 'insurance_rates',
      quality: 'estimated',
    });

    const discharge = override('discharge', DISCHARGE_FEES);
    price -= discharge;
    steps.push({
      label: 'Discharge fees',
      amount: discharge,
      runningPrice: price,
      category: 'port',
      note: 'Destination port discharge',
      editable: true,
      quality: 'estimated',
    });

    corridorPrices.cfr = price;
  }

  // ── CFR → FOB (ocean freight) ──
  if (isActive('fob_to_cfr', 3)) {
    let oceanFreight = 0;
    let oceanNote = '';

    if (destinationCoords) {
      const seaRoute = calculateSeaRoute(loadingPortCoords, destinationCoords, volumeTonnes);
      oceanFreight = seaRoute.freightRatePerTonne;
      oceanNote = `${seaRoute.distanceNm.toLocaleString()}nm, ${seaRoute.vesselClass} class`;
    } else {
      oceanFreight = 25; // Fallback estimate
      oceanNote = 'Estimate — no destination coordinates';
    }

    oceanFreight = override('ocean_freight', oceanFreight);
    price -= oceanFreight;
    steps.push({
      label: 'Ocean freight',
      amount: oceanFreight,
      runningPrice: price,
      category: 'freight',
      note: oceanNote,
      editable: true,
      sourceId: 'sea_freight_calc',
      quality: 'calculated',
    });

    corridorPrices.fob = price;
  }

  // ── FOB → port_gate (stevedoring, handling, wharfage, agency, security, customs, royalty, survey) ──
  if (isActive('portgate_to_fob', 2)) {
    const port = PORT_CHARGES[loadingPort] || PORT_CHARGES.default;

    // Royalty (on FOB value — use current running price as FOB proxy)
    const royaltyRate = ROYALTY_RATES[commodity] || 0.03;
    const royalty = override('royalty', price * royaltyRate);
    price -= royalty;
    steps.push({
      label: `MPRRA royalty (${(royaltyRate * 100).toFixed(0)}%)`,
      amount: royalty,
      runningPrice: price,
      category: 'tax',
      note: `Mineral & Petroleum Resources Royalty Act`,
      editable: true,
      sourceId: 'mprra_royalty',
      quality: 'estimated',
    });

    // Survey & sampling
    const survey = override('survey_sampling', SURVEY_SAMPLING);
    price -= survey;
    steps.push({
      label: 'Surveyor & sampling',
      amount: survey,
      runningPrice: price,
      category: 'port',
      note: 'Independent inspector fees',
      editable: true,
      sourceId: 'port_tariffs',
      quality: 'published',
    });

    // Port costs
    const portCosts: { key: string; label: string; amount: number; note: string }[] = [
      { key: 'stevedoring', label: 'Stevedoring', amount: port.stevedoring, note: 'Loading cargo onto vessel' },
      { key: 'port_handling', label: 'Terminal handling', amount: port.handling, note: `${loadingPort} TPT charges` },
      { key: 'wharfage', label: 'Wharfage', amount: port.wharfage, note: 'TNPA wharfage levy' },
      { key: 'agency', label: 'Port agency', amount: port.agency, note: 'Ship agent fees' },
      { key: 'security', label: 'Port security', amount: port.security, note: 'ISPS levy' },
      { key: 'customs_broker', label: 'Customs broker', amount: port.customs_broker, note: 'SAD500 filing + clearing' },
    ];

    for (const cost of portCosts) {
      const amount = override(cost.key, cost.amount);
      price -= amount;
      steps.push({
        label: cost.label,
        amount,
        runningPrice: price,
        category: 'port',
        note: cost.note,
        editable: true,
        sourceId: 'port_tariffs',
        quality: 'published',
      });
    }

    corridorPrices.port_gate = price;
  }

  // ── port_gate → stockpile (crosshaul) ──
  if (isActive('stockpile_to_portgate', 1)) {
    const port = PORT_CHARGES[loadingPort] || PORT_CHARGES.default;
    const crosshaul = override('crosshaul', port.crosshaul);
    price -= crosshaul;
    steps.push({
      label: 'Crosshaul',
      amount: crosshaul,
      runningPrice: price,
      category: 'port',
      note: 'Stockpile to quayside',
      editable: true,
      sourceId: 'port_tariffs',
      quality: 'published',
    });

    corridorPrices.stockpile = price;
  }

  // ── stockpile → mine_gate (inland transport + weighbridge) ──
  if (isActive('mine_to_stockpile', 0)) {
    // Inland transport
    if (mineCoords) {
      const inlandDistKm = haversineDistance(mineCoords.lat, mineCoords.lng, loadingPortCoords.lat, loadingPortCoords.lng) * 1.852 * 1.3;
      const rates = INLAND_RATES[transportMode];
      let inlandCost = (inlandDistKm * rates.perTonneKm) + (rates.fixedPerShipment / volumeTonnes);
      inlandCost = override('inland_transport', inlandCost);
      price -= inlandCost;
      steps.push({
        label: `Inland ${transportMode} freight`,
        amount: inlandCost,
        runningPrice: price,
        category: 'inland',
        note: `${Math.round(inlandDistKm)}km ${transportMode} to ${loadingPort}`,
        editable: true,
        sourceId: transportMode === 'rail' ? 'transnet_rail' : 'road_freight',
        quality: 'estimated',
      });
    }

    // Weighbridge
    const wb = override('weighbridge', WEIGHBRIDGE);
    price -= wb;
    steps.push({
      label: 'Weighbridge',
      amount: wb,
      runningPrice: price,
      category: 'inland',
      note: 'Per-truck weighbridge at mine',
      editable: true,
      quality: 'estimated',
    });

    corridorPrices.mine_gate = price;
  }

  // ── Financing costs (deducted last) ──
  if (fxHedge !== 'spot') {
    const hedgeInfo = FX_HEDGE_COSTS[fxHedge as FxHedgeType];
    if (hedgeInfo && hedgeInfo.annualizedPct > 0) {
      const fxCost = price * (hedgeInfo.annualizedPct / 100) * (dealDurationMonths / 12);
      price -= fxCost;
      steps.push({
        label: `FX hedge (${hedgeInfo.label})`,
        amount: fxCost,
        runningPrice: price,
        category: 'finance',
        note: `${hedgeInfo.annualizedPct}% p.a. for ${dealDurationMonths}m`,
        quality: 'estimated',
      });
    }
  }

  if (hedgeCommodityPrice) {
    const hedgeInfo = COMMODITY_HEDGE_COSTS[commodity];
    if (hedgeInfo && hedgeInfo.available !== false) {
      const commHedgeCost = price * hedgeInfo.costPct * (dealDurationMonths / 12);
      price -= commHedgeCost;
      steps.push({
        label: `Commodity hedge (${hedgeInfo.instrument})`,
        amount: commHedgeCost,
        runningPrice: price,
        category: 'finance',
        note: hedgeInfo.note,
        quality: 'estimated',
      });
    }
  }

  // ── Result ──
  const totalCosts = sellPrice - price;

  return {
    sellPoint,
    buyPoint,
    sellPrice,
    breakevenBuyPrice: Math.max(0, price),
    totalCosts,
    margin: null,        // Margin calculated by caller using index price
    marginPct: null,
    steps,
    corridorPrices,
  };
}
