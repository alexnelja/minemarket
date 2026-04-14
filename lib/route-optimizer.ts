import { calculateSeaRoute } from './sea-routes';
import { haversineDistance } from './distance';
import { calculateTimeline, SA_RAIL_ROUTES } from './supply-chain-timeline';
import type { GeoPoint, CommodityType } from './types';
import type { TradePoint } from './forward-waterfall';
import {
  PORT_CHARGES, ROYALTY_RATES, INLAND_RATES,
  INSURANCE_RATE, SURVEY_SAMPLING, WEIGHBRIDGE, DISCHARGE_FEES,
  COMMODITY_HANDLING_MULTIPLIER, COMMODITY_TRANSPORT_MULTIPLIER,
  ROAD_MAX_KM, REFERENCE_GRADES,
} from './shipping-constants';

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface TransitRouteOption {
  rank: number;
  transitPort: string;            // SA loading port name
  transitPortCoords: GeoPoint;
  transportMode: 'rail' | 'road';

  // Cost breakdown
  inlandCost: number;             // Mine → port
  inlandDistKm: number;
  inlandDays: number;
  portCosts: number;              // All port charges
  oceanFreight: number;           // Port → destination
  oceanDistNm: number;
  oceanDays: number;
  totalCostPerTonne: number;      // All costs mine → CIF

  // Result
  sellPrice: number;              // CIF delivered cost
  margin: number;                 // Index - sellPrice
  marginPct: number;
  totalProfit: number;
  totalDays: number;              // Full transit time

  // Route details
  inlandRoute: string;            // "620km rail via Coal Line"
  seaRoute: string;               // "9,750nm via Indian Ocean"
}

export interface RouteOptimizationResult {
  origin: string;                 // Mine/stockpile name
  destination: string;            // Buyer port name
  commodity: CommodityType;
  buyPrice: number;
  volumeTonnes: number;
  indexPrice: number | null;
  routes: TransitRouteOption[];
  bestByMargin: TransitRouteOption | null;
  bestBySpeed: TransitRouteOption | null;
  bestByFreight: TransitRouteOption | null;
  optimizedAt: string;
}

// ── SA loading ports ────────────────────────────────────────────────────────

const LOADING_PORTS: { name: string; coords: GeoPoint }[] = [
  { name: 'Richards Bay', coords: { lat: -28.801, lng: 32.038 } },
  { name: 'Saldanha Bay', coords: { lat: -33.004, lng: 17.938 } },
  { name: 'Durban', coords: { lat: -29.868, lng: 31.048 } },
  { name: 'Port Elizabeth', coords: { lat: -33.768, lng: 25.629 } },
  { name: 'Ngqura', coords: { lat: -33.798, lng: 25.685 } },    // Deep-water manganese terminal (16 Mtpa planned)
  { name: 'Maputo', coords: { lat: -25.969, lng: 32.573 } },
];

// Commodity-specific preferred ports — ordered by actual export volume share
// Source: Transnet Freight Rail corridor data, TNPA port statistics, industry reports (2024-2025)
const COMMODITY_PORTS: Record<string, string[]> = {
  chrome:    ['Maputo', 'Richards Bay', 'Durban'],              // Maputo >50% of SA chrome exports (road+rail via Komatipoort)
  manganese: ['Ngqura', 'Saldanha Bay', 'Port Elizabeth', 'Durban'], // Ngqura primary (6→16 Mtpa dedicated terminal), Saldanha MPT 2→8 Mtpa
  iron_ore:  ['Saldanha Bay'],                                  // OREX dedicated line — no viable alternative
  coal:      ['Richards Bay', 'Maputo'],                        // RBCT 91 Mtpa design, 52 Mt actual (2024). Secondary: Maputo Corridor
  platinum:  ['Durban'],                                        // Concentrate via Durban; refined PGMs via OR Tambo air freight
  gold:      ['Durban'],                                        // Dore bars to Rand Refinery → OR Tambo air; sea via Durban is rare
  copper:    ['Richards Bay', 'Maputo'],                        // Phalaborwa via 1986 rail extension to RB, or Maputo Corridor
  vanadium:  ['Durban', 'Richards Bay'],                        // Specialty product, smaller lots via general-purpose terminals
  titanium:  ['Richards Bay'],                                  // RBM mine-to-port — adjacent operations, ~5km
  aggregates: ['Durban', 'Richards Bay', 'Port Elizabeth'],     // Mostly domestic; modest export via multi-purpose terminals
};

// Cost constants imported from lib/shipping-constants.ts (single source of truth)

// ── Main optimization function ──────────────────────────────────────────────

export function optimizeTransitRoutes(params: {
  commodity: CommodityType;
  buyPrice: number;
  volumeTonnes: number;
  originCoords: GeoPoint;       // Mine location
  originName: string;           // Mine name
  destinationCoords: GeoPoint;  // Buyer port
  destinationName: string;
  indexCifPrice?: number;
  buyPoint?: TradePoint;
  sellPoint?: TradePoint;
  grade?: number;               // Actual grade (Cr2O3% or Mn%)
}): RouteOptimizationResult {
  const {
    commodity, buyPrice, volumeTonnes,
    originCoords, originName,
    destinationCoords, destinationName,
    buyPoint = 'mine_gate',
    sellPoint = 'cif',
    grade,
  } = params;

  // Grade-adjust the index price: if trader has 36% chrome vs 42% benchmark, their material is worth less
  const refGrade = REFERENCE_GRADES[commodity];
  const gradeMultiplier = (grade && refGrade) ? grade / refGrade : 1.0;
  const indexCifPrice = params.indexCifPrice ? params.indexCifPrice * gradeMultiplier : undefined;

  // Filter to commodity-relevant ports
  const relevantPortNames = COMMODITY_PORTS[commodity] || LOADING_PORTS.map(p => p.name);
  const ports = LOADING_PORTS.filter(p => relevantPortNames.includes(p.name));

  const routes: TransitRouteOption[] = [];

  for (const port of ports) {
    // Determine transport modes to try
    const modes: ('rail' | 'road')[] = ['rail'];

    // Calculate inland distance to determine if road is viable
    const haversineNm = haversineDistance(originCoords.lat, originCoords.lng, port.coords.lat, port.coords.lng);
    const fallbackDistKm = haversineNm * 1.852 * 1.3;

    const maxRoadKm = ROAD_MAX_KM[commodity] || ROAD_MAX_KM.default;
    if (fallbackDistKm < maxRoadKm) {
      modes.push('road');
    }

    for (const mode of modes) {
      try {
        // ── 1. Inland cost (mine → port) ──────────────────────────
        let inlandDistKm = fallbackDistKm;
        let inlandNote = `~${Math.round(inlandDistKm)}km by ${mode}`;

        // Check for known SA rail route
        if (mode === 'rail') {
          const routeKey = Object.keys(SA_RAIL_ROUTES).find(k =>
            k.toLowerCase().includes(originName.toLowerCase().split(' ')[0]) &&
            k.toLowerCase().includes(port.name.toLowerCase().split(' ')[0])
          );
          if (routeKey) {
            inlandDistKm = SA_RAIL_ROUTES[routeKey].distanceKm;
            inlandNote = `${inlandDistKm}km ${mode} — ${SA_RAIL_ROUTES[routeKey].note}`;
          }
        }

        const rates = INLAND_RATES[mode];
        const multipliers = COMMODITY_TRANSPORT_MULTIPLIER[commodity] || { rail: 1.0, road: 1.0 };
        const transportMultiplier = mode === 'road' ? multipliers.road : multipliers.rail;
        const inlandCost = WEIGHBRIDGE + (inlandDistKm * rates.perTonneKm * transportMultiplier) + (rates.fixedPerShipment / volumeTonnes);

        // Inland transit days
        const inlandDays = mode === 'rail'
          ? Math.ceil(inlandDistKm / 350) + 1  // mainline speed + 1 day loading
          : Math.ceil(inlandDistKm / 500) + 1;

        // ── 2. Port costs ─────────────────────────────────────────
        const portCharges = PORT_CHARGES[port.name] || PORT_CHARGES.default;
        const handlingMultiplier = COMMODITY_HANDLING_MULTIPLIER[commodity] || 1.0;
        const portCosts =
          (portCharges.handling * handlingMultiplier) +
          portCharges.wharfage +
          (portCharges.stevedoring * handlingMultiplier) +
          (portCharges.crosshaul * handlingMultiplier) +
          portCharges.agency +
          portCharges.security +
          portCharges.customs_broker +
          SURVEY_SAMPLING;

        // Royalty (approximate on buy + inland + port costs)
        const royaltyRate = ROYALTY_RATES[commodity] || 0.03;
        const preFobSubtotal = buyPrice + inlandCost + portCosts;
        const royalty = preFobSubtotal * royaltyRate;

        // ── 3. Ocean freight (port → destination) ─────────────────
        let oceanFreight = 0;
        let oceanDistNm = 0;
        let oceanDays = 0;
        let seaRouteNote = '';

        const needsOcean = ['cfr', 'cif'].includes(sellPoint);
        if (needsOcean) {
          try {
            const seaResult = calculateSeaRoute(port.coords, destinationCoords, volumeTonnes);
            oceanFreight = seaResult.freightRatePerTonne;
            oceanDistNm = seaResult.distanceNm;
            oceanDays = seaResult.transitDays;
          } catch {
            // Fallback to haversine
            oceanDistNm = haversineDistance(port.coords.lat, port.coords.lng, destinationCoords.lat, destinationCoords.lng) * 1.4;
            oceanFreight = oceanDistNm * 0.002;
            oceanDays = Math.ceil(oceanDistNm / (13 * 24));
          }
          seaRouteNote = `${Math.round(oceanDistNm).toLocaleString()}nm to ${destinationName}`;
        }

        // ── 4. Insurance ──────────────────────────────────────────
        // Discharge fees only apply when delivering to destination (CFR/CIF)
        const dischargeFees = needsOcean ? DISCHARGE_FEES : 0;
        const subtotalPreInsurance = buyPrice + inlandCost + portCosts + royalty + oceanFreight + dischargeFees;
        const insurance = sellPoint === 'cif' ? subtotalPreInsurance * INSURANCE_RATE : 0;

        // ── 5. Total cost ─────────────────────────────────────────
        const totalCost = subtotalPreInsurance + insurance;
        const sellPrice = totalCost;

        // ── 6. Margin vs index ────────────────────────────────────
        const margin = indexCifPrice ? indexCifPrice - sellPrice : 0;
        const marginPct = indexCifPrice && indexCifPrice > 0 ? (margin / indexCifPrice) * 100 : 0;
        const totalProfit = margin * volumeTonnes;

        // ── 7. Total transit time ─────────────────────────────────
        const timeline = calculateTimeline({
          mineCoords: originCoords,
          portCoords: port.coords,
          destinationCoords: needsOcean ? destinationCoords : undefined,
          mineName: originName,
          portName: port.name,
          destinationName,
          transportMode: mode,
          volumeTonnes,
          buyPoint,
          sellPoint,
        });
        const totalDays = timeline.totalDays;

        routes.push({
          rank: 0,
          transitPort: port.name,
          transitPortCoords: port.coords,
          transportMode: mode,
          inlandCost: Math.round(inlandCost * 100) / 100,
          inlandDistKm: Math.round(inlandDistKm),
          inlandDays,
          portCosts: Math.round((portCosts + royalty) * 100) / 100,
          oceanFreight: Math.round(oceanFreight * 100) / 100,
          oceanDistNm: Math.round(oceanDistNm),
          oceanDays,
          totalCostPerTonne: Math.round(totalCost * 100) / 100,
          sellPrice: Math.round(sellPrice * 100) / 100,
          margin: Math.round(margin * 100) / 100,
          marginPct: Math.round(marginPct * 10) / 10,
          totalProfit: Math.round(totalProfit),
          totalDays,
          inlandRoute: `${Math.round(inlandDistKm).toLocaleString()}km ${mode}${inlandNote.includes('—') ? ' — ' + inlandNote.split('—')[1].trim() : ''}`,
          seaRoute: seaRouteNote,
        });
      } catch {
        // Skip failed route calculations
      }
    }
  }

  // Sort by margin (highest first)
  routes.sort((a, b) => b.margin - a.margin);
  routes.forEach((r, i) => { r.rank = i + 1; });

  // Best-of selections
  const isFob = !['cfr', 'cif'].includes(sellPoint);
  const bestByMargin = routes[0] || null;
  const bestBySpeed = routes.length > 0
    ? routes.reduce((best, r) => r.totalDays < best.totalDays ? r : best)
    : null;
  const bestByFreight = routes.length > 0
    ? (isFob
      ? routes.reduce((best, r) => r.totalCostPerTonne < best.totalCostPerTonne ? r : best)
      : routes.reduce((best, r) => r.oceanFreight < best.oceanFreight ? r : best))
    : null;

  return {
    origin: originName,
    destination: isFob ? 'FOB at best port' : destinationName,
    commodity,
    buyPrice,
    volumeTonnes,
    indexPrice: indexCifPrice ?? null,
    routes,
    bestByMargin,
    bestBySpeed,
    bestByFreight,
    optimizedAt: new Date().toISOString(),
  };
}

// ── Legacy wrapper for backward compatibility ───────────────────────────────

export interface OptimizeParams {
  commodity: CommodityType;
  buyPoint: TradePoint;
  sellPoint: TradePoint;
  buyPrice: number;
  volumeTonnes: number;
  mineCoords?: GeoPoint;
  mineName?: string;
  indexCifPrice?: number;
  fxHedge?: string;
  hedgeCommodityPrice?: boolean;
  dealCurrency?: string;
}

/** @deprecated Use optimizeTransitRoutes instead */
export function optimizeRoutes(params: OptimizeParams): RouteOptimizationResult {
  // Default mine coords if not provided (Steelpoort for chrome, Hotazel for manganese)
  const defaultMines: Record<string, { coords: GeoPoint; name: string }> = {
    chrome: { coords: { lat: -24.69, lng: 30.19 }, name: 'Steelpoort Chrome' },
    manganese: { coords: { lat: -27.24, lng: 22.95 }, name: 'Hotazel Manganese' },
  };
  const mine = defaultMines[params.commodity] || { coords: { lat: -24.69, lng: 30.19 }, name: 'Mine' };

  // Default destination: Qingdao
  const defaultDest = { coords: { lat: 36.067, lng: 120.383 }, name: 'Qingdao, China' };

  return optimizeTransitRoutes({
    commodity: params.commodity,
    buyPrice: params.buyPrice,
    volumeTonnes: params.volumeTonnes,
    originCoords: params.mineCoords || mine.coords,
    originName: params.mineName || mine.name,
    destinationCoords: defaultDest.coords,
    destinationName: defaultDest.name,
    indexCifPrice: params.indexCifPrice,
    buyPoint: params.buyPoint,
    sellPoint: params.sellPoint,
  });
}

// Export constants for UI
export { LOADING_PORTS, COMMODITY_PORTS };

// Re-export for backward compatibility
const DESTINATIONS: { name: string; coords: GeoPoint; region: string }[] = [
  { name: 'Qingdao, China', coords: { lat: 36.067, lng: 120.383 }, region: 'East Asia' },
  { name: 'Qinzhou, China', coords: { lat: 21.683, lng: 108.647 }, region: 'East Asia' },
  { name: 'Shanghai, China', coords: { lat: 31.230, lng: 121.474 }, region: 'East Asia' },
  { name: 'Mumbai, India', coords: { lat: 18.940, lng: 72.840 }, region: 'South Asia' },
  { name: 'Visakhapatnam, India', coords: { lat: 17.686, lng: 83.218 }, region: 'South Asia' },
  { name: 'Rotterdam, Netherlands', coords: { lat: 51.953, lng: 4.133 }, region: 'Europe' },
  { name: 'Kashima, Japan', coords: { lat: 35.900, lng: 140.620 }, region: 'East Asia' },
  { name: 'Singapore', coords: { lat: 1.264, lng: 103.822 }, region: 'Southeast Asia' },
  { name: 'Iskenderun, Turkey', coords: { lat: 36.585, lng: 36.175 }, region: 'Middle East' },
];
export { DESTINATIONS };
