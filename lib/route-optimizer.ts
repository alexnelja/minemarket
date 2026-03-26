import { calculateSeaRoute } from './sea-routes';
import { haversineDistance } from './distance';
import { calculateTimeline, SA_RAIL_ROUTES } from './supply-chain-timeline';
import type { GeoPoint, CommodityType } from './types';
import type { TradePoint } from './forward-waterfall';

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
  { name: 'Maputo', coords: { lat: -25.969, lng: 32.573 } },
];

// Commodity-specific preferred ports (not all ports handle all commodities)
const COMMODITY_PORTS: Record<string, string[]> = {
  chrome: ['Richards Bay', 'Durban', 'Maputo'],
  manganese: ['Saldanha Bay', 'Port Elizabeth', 'Durban'],
  iron_ore: ['Saldanha Bay', 'Richards Bay'],
  coal: ['Richards Bay'],
  platinum: ['Durban', 'Richards Bay'],
  gold: ['Durban'],
  copper: ['Durban', 'Richards Bay'],
  vanadium: ['Durban', 'Richards Bay'],
  titanium: ['Richards Bay'],
  aggregates: ['Durban', 'Richards Bay', 'Port Elizabeth'],
};

// ── Cost constants (mirrored from forward-waterfall) ────────────────────────

const PORT_CHARGES: Record<string, {
  handling: number; wharfage: number; stevedoring: number; crosshaul: number;
  agency: number; security: number; customs_broker: number;
}> = {
  'Richards Bay':    { handling: 4.00, wharfage: 1.20, stevedoring: 3.00, crosshaul: 1.50, agency: 0.30, security: 0.10, customs_broker: 0.40 },
  'Saldanha Bay':    { handling: 3.80, wharfage: 1.10, stevedoring: 2.80, crosshaul: 1.20, agency: 0.30, security: 0.10, customs_broker: 0.40 },
  'Durban':          { handling: 4.50, wharfage: 1.40, stevedoring: 3.50, crosshaul: 2.00, agency: 0.35, security: 0.12, customs_broker: 0.45 },
  'Port Elizabeth':  { handling: 4.20, wharfage: 1.30, stevedoring: 3.20, crosshaul: 1.80, agency: 0.30, security: 0.10, customs_broker: 0.40 },
  'Maputo':          { handling: 5.00, wharfage: 1.60, stevedoring: 3.80, crosshaul: 2.20, agency: 0.50, security: 0.15, customs_broker: 0.60 },
  default:           { handling: 4.50, wharfage: 1.30, stevedoring: 3.20, crosshaul: 1.80, agency: 0.35, security: 0.10, customs_broker: 0.45 },
};

const INLAND_RATES = {
  rail: { perTonneKm: 0.032, fixedPerShipment: 200 },
  road: { perTonneKm: 0.18, fixedPerShipment: 50 },
};

const ROYALTY_RATES: Record<string, number> = {
  chrome: 0.03, manganese: 0.03, iron_ore: 0.04, coal: 0.02, aggregates: 0.01,
  platinum: 0.05, gold: 0.05, copper: 0.03, vanadium: 0.03, titanium: 0.03,
};

const INSURANCE_RATE = 0.0015;
const SURVEY_SAMPLING = 0.70;
const WEIGHBRIDGE = 0.27;
const DISCHARGE_FEES = 4.50;

const ROAD_MAX_KM = 500; // Road only viable under 500km

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
}): RouteOptimizationResult {
  const {
    commodity, buyPrice, volumeTonnes,
    originCoords, originName,
    destinationCoords, destinationName,
    indexCifPrice,
    buyPoint = 'mine_gate',
    sellPoint = 'cif',
  } = params;

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

    if (fallbackDistKm < ROAD_MAX_KM) {
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
        const inlandCost = WEIGHBRIDGE + (inlandDistKm * rates.perTonneKm) + (rates.fixedPerShipment / volumeTonnes);

        // Inland transit days
        const inlandDays = mode === 'rail'
          ? Math.ceil(inlandDistKm / 350) + 1  // mainline speed + 1 day loading
          : Math.ceil(inlandDistKm / 500) + 1;

        // ── 2. Port costs ─────────────────────────────────────────
        const portCharges = PORT_CHARGES[port.name] || PORT_CHARGES.default;
        const portCosts =
          portCharges.handling +
          portCharges.wharfage +
          portCharges.stevedoring +
          portCharges.crosshaul +
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
        const subtotalPreInsurance = buyPrice + inlandCost + portCosts + royalty + oceanFreight + DISCHARGE_FEES;
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
  const bestByMargin = routes[0] || null;
  const bestBySpeed = routes.length > 0
    ? routes.reduce((best, r) => r.totalDays < best.totalDays ? r : best)
    : null;
  const bestByFreight = routes.length > 0
    ? routes.reduce((best, r) => r.oceanFreight < best.oceanFreight ? r : best)
    : null;

  return {
    origin: originName,
    destination: destinationName,
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
