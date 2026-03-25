const EARTH_RADIUS_KM = 6_371;
const KM_PER_NM = 1.852;
const SEA_ROUTE_MULTIPLIER = 1.4;
const DEFAULT_SPEED_KNOTS = 13;

// IMO/IEA standard emission factors for bulk cargo (kgCO₂ per tonne-km)
const EMISSION_FACTORS: Record<TransportMode, number> = {
  sea: 0.008,
  rail: 0.022,
  road: 0.062,
};

export type TransportMode = 'sea' | 'rail' | 'road';

export interface RouteEstimate {
  nauticalMiles: number;
  km: number;
  transitDays: number;
  co2Tonnes: number;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Great-circle distance between two coordinates using the Haversine formula.
 * Returns distance in nautical miles.
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const km = EARTH_RADIUS_KM * c;
  return km / KM_PER_NM;
}

/**
 * Estimated sea distance with a 1.4x multiplier on great-circle distance.
 * Sea routes follow coastlines, not straight lines.
 */
export function estimateSeaDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  return haversineDistance(lat1, lng1, lat2, lng2) * SEA_ROUTE_MULTIPLIER;
}

/**
 * Estimated days at sea for a given distance and speed.
 * Default speed is 13 knots (standard bulk carrier).
 */
export function estimateTransitDays(
  nauticalMiles: number,
  speedKnots: number = DEFAULT_SPEED_KNOTS,
): number {
  const hoursAtSea = nauticalMiles / speedKnots;
  return hoursAtSea / 24;
}

/**
 * CO₂ footprint in tonnes for transporting cargo.
 * Uses IMO/IEA standard emission factors for bulk cargo.
 */
export function estimateCarbonFootprint(
  distanceKm: number,
  volumeTonnes: number,
  mode: TransportMode,
): number {
  const factor = EMISSION_FACTORS[mode];
  return (factor * volumeTonnes * distanceKm) / 1_000; // convert kg to tonnes
}

/**
 * Format a distance for display.
 * Returns "1,234 nm" for nautical miles, or converts to km if called with km.
 */
export function formatDistance(nm: number): string {
  const km = nm * KM_PER_NM;
  return `${Math.round(nm).toLocaleString('en-US')} nm (${Math.round(km).toLocaleString('en-US')} km)`;
}

/**
 * Full route estimate between two coordinates.
 */
export function estimateRoute(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  volumeTonnes: number,
): RouteEstimate {
  const nauticalMiles = estimateSeaDistance(originLat, originLng, destLat, destLng);
  const km = nauticalMiles * KM_PER_NM;
  const transitDays = estimateTransitDays(nauticalMiles);
  const co2Tonnes = estimateCarbonFootprint(km, volumeTonnes, 'sea');

  return {
    nauticalMiles: Math.round(nauticalMiles),
    km: Math.round(km),
    transitDays: Math.round(transitDays * 10) / 10,
    co2Tonnes: Math.round(co2Tonnes * 10) / 10,
  };
}

export const COMMON_DESTINATIONS = [
  { name: 'Qinzhou, China', lat: 21.683, lng: 108.647 },
  { name: 'Qingdao, China', lat: 36.067, lng: 120.383 },
  { name: 'Mumbai, India', lat: 18.94, lng: 72.84 },
  { name: 'Rotterdam, Netherlands', lat: 51.95, lng: 4.13 },
  { name: 'Kashima, Japan', lat: 35.9, lng: 140.62 },
] as const;
