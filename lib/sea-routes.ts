import type { GeoPoint } from './types';

export interface SeaRouteResult {
  coordinates: [number, number][];  // GeoJSON LineString coordinates
  distanceNm: number;               // Nautical miles
  distanceKm: number;
  transitDays: number;
  fuelCostUsd: number;
  freightRatePerTonne: number;      // Estimated $/t
  co2Tonnes: number;
  vesselClass: string;
  breakdown: { label: string; value: string; note?: string }[];
}

// Vessel economics for bulk carriers (2024-2026 averages)
const VESSEL_CLASSES = {
  handysize: {
    label: 'Handysize',
    dwt: 35000,        // deadweight tonnes
    speedKnots: 12,
    fuelPerDay: 22,    // tonnes VLSFO per day at sea
    portFuelPerDay: 4, // tonnes at port
    dailyCost: 8500,   // $/day time charter equivalent (TCE)
    loadDays: 3,
    dischargeDays: 3,
  },
  supramax: {
    label: 'Supramax',
    dwt: 58000,
    speedKnots: 13,
    fuelPerDay: 28,
    portFuelPerDay: 5,
    dailyCost: 11000,
    loadDays: 4,
    dischargeDays: 4,
  },
  panamax: {
    label: 'Panamax',
    dwt: 82000,
    speedKnots: 13.5,
    fuelPerDay: 32,
    portFuelPerDay: 5,
    dailyCost: 13000,
    loadDays: 5,
    dischargeDays: 5,
  },
  capesize: {
    label: 'Capesize',
    dwt: 180000,
    speedKnots: 14,
    fuelPerDay: 45,
    portFuelPerDay: 6,
    dailyCost: 18000,
    loadDays: 6,
    dischargeDays: 6,
  },
};

const BUNKER_PRICE_USD_PER_TONNE = 550; // VLSFO average 2025-2026

// Select vessel class based on cargo volume
export function selectVessel(volumeTonnes: number) {
  if (volumeTonnes <= 35000) return VESSEL_CLASSES.handysize;
  if (volumeTonnes <= 58000) return VESSEL_CLASSES.supramax;
  if (volumeTonnes <= 82000) return VESSEL_CLASSES.panamax;
  return VESSEL_CLASSES.capesize;
}

export function calculateSeaRoute(
  origin: GeoPoint,
  destination: GeoPoint,
  volumeTonnes: number = 50000,
): SeaRouteResult {
  // Calculate route using searoute-js
  let coordinates: [number, number][] = [];
  let distanceNm = 0;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const searoute = require('searoute-js');
    const route = searoute([origin.lng, origin.lat], [destination.lng, destination.lat]);
    coordinates = route.geometry.coordinates;
    distanceNm = route.properties.length;
  } catch {
    // Fallback to Haversine with 1.4x multiplier if searoute fails
    const { estimateSeaDistance } = require('./distance');
    distanceNm = estimateSeaDistance(origin.lat, origin.lng, destination.lat, destination.lng);
    // Generate simple 2-point line
    coordinates = [[origin.lng, origin.lat], [destination.lng, destination.lat]];
  }

  const distanceKm = distanceNm * 1.852;
  const vessel = selectVessel(volumeTonnes);

  // Transit calculation
  const seaDays = distanceNm / (vessel.speedKnots * 24);
  const totalDays = seaDays + vessel.loadDays + vessel.dischargeDays;
  const transitDays = Math.ceil(seaDays);

  // Fuel cost
  const seaFuel = seaDays * vessel.fuelPerDay;
  const portFuel = (vessel.loadDays + vessel.dischargeDays) * vessel.portFuelPerDay;
  const totalFuel = seaFuel + portFuel;
  const fuelCostUsd = totalFuel * BUNKER_PRICE_USD_PER_TONNE;

  // Total voyage cost
  const hireCost = totalDays * vessel.dailyCost;
  const totalVoyageCost = fuelCostUsd + hireCost;

  // Freight rate per tonne (voyage cost / cargo)
  const cargoTonnes = Math.min(volumeTonnes, vessel.dwt * 0.95); // 95% utilization
  const freightRatePerTonne = totalVoyageCost / cargoTonnes;

  // CO2: IMO emission factor for VLSFO = 3.151 tCO2 per tonne of fuel
  const co2Tonnes = totalFuel * 3.151;

  return {
    coordinates,
    distanceNm: Math.round(distanceNm),
    distanceKm: Math.round(distanceKm),
    transitDays,
    fuelCostUsd: Math.round(fuelCostUsd),
    freightRatePerTonne: Math.round(freightRatePerTonne * 100) / 100,
    co2Tonnes: Math.round(co2Tonnes * 10) / 10,
    vesselClass: vessel.label,
    breakdown: [
      { label: 'Route distance', value: `${Math.round(distanceNm).toLocaleString()} nm`, note: `${Math.round(distanceKm).toLocaleString()} km` },
      { label: 'Vessel class', value: vessel.label, note: `${vessel.dwt.toLocaleString()} DWT` },
      { label: 'Sea transit', value: `${transitDays} days`, note: `at ${vessel.speedKnots} knots` },
      { label: 'Port time', value: `${vessel.loadDays + vessel.dischargeDays} days`, note: `load ${vessel.loadDays}d + discharge ${vessel.dischargeDays}d` },
      { label: 'Fuel consumption', value: `${Math.round(totalFuel)} t VLSFO`, note: `at sea: ${Math.round(seaFuel)}t, port: ${Math.round(portFuel)}t` },
      { label: 'Fuel cost', value: `$${Math.round(fuelCostUsd).toLocaleString()}`, note: `at $${BUNKER_PRICE_USD_PER_TONNE}/t VLSFO` },
      { label: 'Vessel hire', value: `$${Math.round(hireCost).toLocaleString()}`, note: `$${vessel.dailyCost.toLocaleString()}/day \u00d7 ${totalDays.toFixed(1)} days` },
      { label: 'Total voyage cost', value: `$${Math.round(totalVoyageCost).toLocaleString()}` },
      { label: 'Freight rate', value: `$${freightRatePerTonne.toFixed(2)}/t`, note: `for ${cargoTonnes.toLocaleString()}t cargo` },
      { label: 'CO\u2082 emissions', value: `${co2Tonnes.toFixed(1)} t CO\u2082`, note: `IMO VLSFO factor 3.151` },
    ],
  };
}

// Pre-calculated common routes from SA ports
export const SA_ROUTES = [
  { from: 'Richards Bay', to: 'Qingdao, China', fromCoords: { lng: 32.038, lat: -28.801 }, toCoords: { lng: 120.383, lat: 36.067 } },
  { from: 'Richards Bay', to: 'Mumbai, India', fromCoords: { lng: 32.038, lat: -28.801 }, toCoords: { lng: 72.84, lat: 18.94 } },
  { from: 'Saldanha Bay', to: 'Rotterdam, NL', fromCoords: { lng: 17.938, lat: -33.004 }, toCoords: { lng: 4.133, lat: 51.953 } },
  { from: 'Saldanha Bay', to: 'Qingdao, China', fromCoords: { lng: 17.938, lat: -33.004 }, toCoords: { lng: 120.383, lat: 36.067 } },
  { from: 'Richards Bay', to: 'Kashima, Japan', fromCoords: { lng: 32.038, lat: -28.801 }, toCoords: { lng: 140.62, lat: 35.9 } },
  { from: 'Durban', to: 'Singapore', fromCoords: { lng: 31.048, lat: -29.868 }, toCoords: { lng: 103.822, lat: 1.264 } },
] as const;
