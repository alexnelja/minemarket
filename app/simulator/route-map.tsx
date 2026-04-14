'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { GeoPoint } from '@/lib/types';
import type { TransitRouteOption } from '@/lib/route-optimizer';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

interface RouteMapProps {
  origin: { name: string; coords: GeoPoint } | null;
  destination: { name: string; coords: GeoPoint } | null;
  routes: TransitRouteOption[];
  bestRouteRank: number | null;
  selectedRoutePort?: string;
  onSelectRoute?: (port: string, mode: string) => void;
  isFob: boolean;
}

// Pre-computed rail route data
interface RailRoute {
  mine: string;
  port: string;
  distance_km: number;
  coordinates: [number, number][];
}

export function RouteMap({ origin, destination, routes, bestRouteRank, selectedRoutePort, onSelectRoute, isFob }: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [railRoutes, setRailRoutes] = useState<RailRoute[]>([]);
  const [mapReady, setMapReady] = useState(false);

  // Load pre-computed rail routes
  useEffect(() => {
    fetch('/data/rail-routes.json')
      .then(res => res.json())
      .then(data => setRailRoutes(data.routes || []))
      .catch(() => {});
  }, []);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [28, -28],
      zoom: 4.5,
    });

    map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');

    map.on('style.load', () => {
      mapRef.current = map;
      setMapReady(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  // Render routes when data changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !origin) return;

    // Clean up previous layers
    const layerIds = ['rail-bg', 'route-best-inland', 'route-best-ocean', ...routes.flatMap((_, i) => [`route-alt-${i}-inland`, `route-alt-${i}-ocean`])];
    for (const id of layerIds) {
      if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(id)) map.removeSource(id);
    }
    // Also clean markers
    const existingMarkers = document.querySelectorAll('.route-map-marker');
    existingMarkers.forEach(el => el.remove());

    // Find matching rail routes for origin mine
    const originName = origin.name.toLowerCase();
    const matchingRails = railRoutes.filter(r =>
      originName.includes(r.mine.toLowerCase()) || r.mine.toLowerCase().includes(originName.split(':')[0].trim().toLowerCase().split(' ')[0])
    );

    // Background: faint rail network for context
    if (!map.getSource('rail-bg')) {
      fetch('/za-railways.geojson')
        .then(res => res.json())
        .then(geojson => {
          if (!map.getSource('rail-bg')) {
            map.addSource('rail-bg', { type: 'geojson', data: geojson });
            map.addLayer({
              id: 'rail-bg',
              type: 'line',
              source: 'rail-bg',
              paint: { 'line-color': '#334155', 'line-width': 0.5, 'line-opacity': 0.2 },
            });
          }
        })
        .catch(() => {});
    }

    // Draw routes for each transit port option
    const bestRoute = routes.find(r => r.rank === bestRouteRank);

    // Draw alternatives first (behind best)
    routes.forEach((route, i) => {
      if (route.rank === bestRouteRank) return;

      const railMatch = matchingRails.find(r => r.port === route.transitPort);
      const inlandId = `route-alt-${i}-inland`;

      if (railMatch && railMatch.coordinates.length > 1) {
        map.addSource(inlandId, {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: railMatch.coordinates } },
        });
        map.addLayer({
          id: inlandId,
          type: 'line',
          source: inlandId,
          paint: { 'line-color': '#6b7280', 'line-width': 2, 'line-opacity': 0.25 },
        });
      } else {
        // Straight line fallback
        map.addSource(inlandId, {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[origin.coords.lng, origin.coords.lat], [route.transitPortCoords.lng, route.transitPortCoords.lat]] } },
        });
        map.addLayer({
          id: inlandId,
          type: 'line',
          source: inlandId,
          paint: { 'line-color': '#6b7280', 'line-width': 1.5, 'line-opacity': 0.2, 'line-dasharray': [4, 4] },
        });
      }
    });

    // Draw best route on top
    if (bestRoute) {
      const railMatch = matchingRails.find(r => r.port === bestRoute.transitPort);
      const bestInlandId = 'route-best-inland';

      if (railMatch && railMatch.coordinates.length > 1) {
        map.addSource(bestInlandId, {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: railMatch.coordinates } },
        });
        map.addLayer({
          id: bestInlandId,
          type: 'line',
          source: bestInlandId,
          paint: { 'line-color': '#10b981', 'line-width': 3, 'line-opacity': 0.9 },
        });
      }

      // Sea route for best (CIF/CFR only)
      if (!isFob && destination && bestRoute.oceanDistNm > 0) {
        // Simple great-circle arc for sea route
        const seaCoords = generateArc(
          [bestRoute.transitPortCoords.lng, bestRoute.transitPortCoords.lat],
          [destination.coords.lng, destination.coords.lat],
          30
        );
        const bestOceanId = 'route-best-ocean';
        map.addSource(bestOceanId, {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: seaCoords } },
        });
        map.addLayer({
          id: bestOceanId,
          type: 'line',
          source: bestOceanId,
          paint: { 'line-color': '#10b981', 'line-width': 2, 'line-opacity': 0.6, 'line-dasharray': [6, 3] },
        });
      }
    }

    // Markers: origin (mine), transit ports, destination
    addMarker(map, origin.coords, origin.name, '#10b981', '⛏');

    // Transit port markers
    const uniquePorts = new Map<string, TransitRouteOption>();
    routes.forEach(r => {
      if (!uniquePorts.has(r.transitPort)) uniquePorts.set(r.transitPort, r);
    });
    uniquePorts.forEach((route) => {
      const isBest = route.rank === bestRouteRank;
      addMarker(map, route.transitPortCoords, route.transitPort, isBest ? '#f59e0b' : '#6b7280', '⚓');
    });

    if (!isFob && destination) {
      addMarker(map, destination.coords, destination.name, '#f59e0b', '📦');
    }

    // Fit bounds to show all points
    const allCoords: [number, number][] = [[origin.coords.lng, origin.coords.lat]];
    routes.forEach(r => allCoords.push([r.transitPortCoords.lng, r.transitPortCoords.lat]));
    if (!isFob && destination) allCoords.push([destination.coords.lng, destination.coords.lat]);

    if (allCoords.length > 1) {
      const lngs = allCoords.map(c => c[0]);
      const lats = allCoords.map(c => c[1]);
      const sw: [number, number] = [Math.min(...lngs), Math.min(...lats)];
      const ne: [number, number] = [Math.max(...lngs), Math.max(...lats)];
      map.fitBounds([sw, ne], { padding: 60, maxZoom: 8 });
    }

  }, [mapReady, origin, destination, routes, bestRouteRank, railRoutes, isFob]);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div ref={containerRef} style={{ height: 350, width: '100%' }} />
      {routes.length > 0 && (
        <div className="px-4 py-2 flex items-center gap-4 text-[10px] text-gray-500 border-t border-gray-800">
          <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-emerald-500 inline-block" /> Best route</span>
          <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-gray-500 inline-block opacity-40" /> Alternatives</span>
          <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-emerald-500 inline-block" style={{ borderBottom: '1px dashed' }} /> Sea route</span>
        </div>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function addMarker(map: mapboxgl.Map, coords: GeoPoint, label: string, color: string, emoji: string) {
  const el = document.createElement('div');
  el.className = 'route-map-marker';
  el.style.cssText = `
    width: 28px; height: 28px; border-radius: 50%;
    background: ${color}20; border: 2px solid ${color};
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; cursor: pointer;
  `;
  el.textContent = emoji;

  new mapboxgl.Marker({ element: el })
    .setLngLat([coords.lng, coords.lat])
    .setPopup(new mapboxgl.Popup({ offset: 15, closeButton: false }).setText(label))
    .addTo(map);
}

function generateArc(start: [number, number], end: [number, number], points: number): [number, number][] {
  // Simple interpolation with slight curve for visual appeal
  const coords: [number, number][] = [];
  for (let i = 0; i <= points; i++) {
    const t = i / points;
    const lng = start[0] + (end[0] - start[0]) * t;
    const lat = start[1] + (end[1] - start[1]) * t;
    // Add slight curvature (offset towards equator for southern routes)
    const bulge = Math.sin(t * Math.PI) * 3;
    coords.push([lng, lat + bulge]);
  }
  return coords;
}
