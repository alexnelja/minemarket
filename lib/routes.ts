import type { GeoPoint } from './types';

export interface RouteSegment {
  type: 'road' | 'ocean';
  coordinates: [number, number][];  // [lng, lat][]
  distance_km: number;
  label: string;
}

/**
 * Fetch driving route from Mapbox Directions API
 */
export async function fetchRoadRoute(
  from: GeoPoint,
  to: GeoPoint,
  label: string
): Promise<RouteSegment | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;

  try {
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${from.lng},${from.lat};${to.lng},${to.lat}?geometries=geojson&overview=full&access_token=${token}`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    const route = data.routes?.[0];
    if (!route) return null;

    return {
      type: 'road',
      coordinates: route.geometry.coordinates,
      distance_km: Math.round(route.distance / 1000),
      label,
    };
  } catch {
    return null;
  }
}

/**
 * Generate a great-circle arc for ocean freight.
 * Uses intermediate waypoints for realistic shipping lanes.
 */
export function generateOceanRoute(
  from: GeoPoint,
  to: GeoPoint,
  label: string
): RouteSegment {
  // Generate waypoints for realistic shipping lanes from SA
  const waypoints = getShippingWaypoints(from, to);
  const allPoints: [number, number][] = [
    [from.lng, from.lat],
    ...waypoints,
    [to.lng, to.lat],
  ];

  // Interpolate great-circle arcs between consecutive points
  const coordinates: [number, number][] = [];
  for (let i = 0; i < allPoints.length - 1; i++) {
    const arc = interpolateGreatCircle(allPoints[i], allPoints[i + 1], 20);
    coordinates.push(...arc);
  }

  // Rough distance calculation
  const distance_km = Math.round(haversineDistance(from, to));

  return { type: 'ocean', coordinates, distance_km, label };
}

/**
 * Get intermediate waypoints for realistic SA shipping lanes
 */
function getShippingWaypoints(from: GeoPoint, to: GeoPoint): [number, number][] {
  // Determine which shipping lane based on destination
  const destLng = to.lng;
  const destLat = to.lat;

  // East Africa coast point (off Mozambique)
  const mozambiqueChannel: [number, number] = [40.5, -15.0];
  // Horn of Africa
  const hornOfAfrica: [number, number] = [51.0, 11.0];
  // Gulf of Aden / Red Sea entry
  const adenGulf: [number, number] = [45.0, 12.5];
  // Suez approach
  const suezApproach: [number, number] = [34.0, 28.0];
  // Indian Ocean mid-point
  const indianOceanMid: [number, number] = [65.0, -5.0];
  // Strait of Malacca approach
  const malaccaApproach: [number, number] = [95.0, 5.0];
  // South China Sea
  const southChinaSea: [number, number] = [110.0, 10.0];

  // Route to China/East Asia (via Indian Ocean, Malacca Strait)
  if (destLng > 100 && destLat > 20) {
    return [mozambiqueChannel, indianOceanMid, malaccaApproach, southChinaSea];
  }

  // Route to India (via Indian Ocean direct)
  if (destLng > 70 && destLng < 100 && destLat > 0) {
    return [mozambiqueChannel, indianOceanMid];
  }

  // Route to Turkey/Mediterranean (via Suez Canal)
  if (destLng > 25 && destLng < 45 && destLat > 30) {
    return [mozambiqueChannel, hornOfAfrica, adenGulf, suezApproach];
  }

  // Route to Europe (via Suez)
  if (destLng > -10 && destLng < 25 && destLat > 35) {
    return [mozambiqueChannel, hornOfAfrica, adenGulf, suezApproach];
  }

  // Default: direct great circle with one mid-ocean waypoint
  const midLng = (from.lng + to.lng) / 2;
  const midLat = (from.lat + to.lat) / 2;
  return [[midLng, midLat]];
}

/**
 * Interpolate great-circle arc between two points
 */
function interpolateGreatCircle(
  start: [number, number],
  end: [number, number],
  numPoints: number
): [number, number][] {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;

  const lat1 = toRad(start[1]);
  const lng1 = toRad(start[0]);
  const lat2 = toRad(end[1]);
  const lng2 = toRad(end[0]);

  const d = 2 * Math.asin(
    Math.sqrt(
      Math.sin((lat2 - lat1) / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin((lng2 - lng1) / 2) ** 2
    )
  );

  if (d < 0.0001) return [start, end];

  const points: [number, number][] = [];
  for (let i = 0; i <= numPoints; i++) {
    const f = i / numPoints;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(lat1) * Math.cos(lng1) + B * Math.cos(lat2) * Math.cos(lng2);
    const y = A * Math.cos(lat1) * Math.sin(lng1) + B * Math.cos(lat2) * Math.sin(lng2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    const lat = toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)));
    const lng = toDeg(Math.atan2(y, x));
    points.push([lng, lat]);
  }
  return points;
}

function haversineDistance(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
