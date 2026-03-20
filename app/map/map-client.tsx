'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { COMMODITY_CONFIG, MineWithGeo, HarbourWithGeo, ListingWithDetails, CommodityType } from '@/lib/types';
import { ListingsPanel } from './listings-panel';

interface RouteData {
  origin_mine_id: string;
  harbour_id: string;
  mine_location: { lng: number; lat: number };
  harbour_location: { lng: number; lat: number };
}

interface MapClientProps {
  mines: MineWithGeo[];
  harbours: HarbourWithGeo[];
  listings: ListingWithDetails[];
  routes: RouteData[];
}

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

export function MapClient({ mines, harbours, listings, routes }: MapClientProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [hoveredListingId, setHoveredListingId] = useState<string | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [26, -29],
      zoom: 5,
    });

    mapRef.current = map;

    // Navigation controls bottom-right
    map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');

    map.on('style.load', () => {
      // --- Route lines ---
      const routeFeatures: GeoJSON.Feature<GeoJSON.LineString>[] = routes.map((r) => ({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [r.mine_location.lng, r.mine_location.lat],
            [r.harbour_location.lng, r.harbour_location.lat],
          ],
        },
        properties: {},
      }));

      map.addSource('routes', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: routeFeatures,
        },
      });

      map.addLayer({
        id: 'routes-layer',
        type: 'line',
        source: 'routes',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#6b7280',
          'line-width': 1.5,
          'line-dasharray': [3, 3],
          'line-opacity': 0.6,
        },
      });

      // --- Mine markers ---
      for (const mine of mines) {
        const primaryCommodity = mine.commodities[0] as CommodityType | undefined;
        const color = primaryCommodity ? COMMODITY_CONFIG[primaryCommodity]?.color ?? '#9ca3af' : '#9ca3af';

        const el = document.createElement('div');
        el.style.width = '14px';
        el.style.height = '14px';
        el.style.borderRadius = '50%';
        el.style.backgroundColor = color;
        el.style.border = '2px solid rgba(255,255,255,0.25)';
        el.style.cursor = 'pointer';
        el.style.boxShadow = `0 0 6px ${color}80`;

        const popupHtml = `
          <div style="font-family: sans-serif; padding: 4px 2px;">
            <div style="font-weight: 600; font-size: 13px; color: #f9fafb; margin-bottom: 2px;">${mine.name}</div>
            <div style="font-size: 11px; color: #9ca3af;">${mine.region}, ${mine.country}</div>
            <div style="font-size: 11px; color: #9ca3af; margin-top: 2px;">
              ${mine.commodities.map((c) => COMMODITY_CONFIG[c as CommodityType]?.label ?? c).join(' · ')}
            </div>
          </div>
        `;

        const popup = new mapboxgl.Popup({ offset: 10, closeButton: false })
          .setHTML(popupHtml);

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([mine.location.lng, mine.location.lat])
          .setPopup(popup)
          .addTo(map);

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          popup.addTo(map);
        });

        markersRef.current.push(marker);
      }

      // --- Harbour markers ---
      for (const harbour of harbours) {
        const el = document.createElement('div');
        el.style.width = '12px';
        el.style.height = '12px';
        el.style.borderRadius = '2px';
        el.style.backgroundColor = '#10b981';
        el.style.border = '2px solid rgba(255,255,255,0.25)';
        el.style.cursor = 'pointer';

        const popupHtml = `
          <div style="font-family: sans-serif; padding: 4px 2px;">
            <div style="font-weight: 600; font-size: 13px; color: #f9fafb; margin-bottom: 2px;">${harbour.name}</div>
            <div style="font-size: 11px; color: #9ca3af;">${harbour.country} · ${harbour.type}</div>
          </div>
        `;

        const popup = new mapboxgl.Popup({ offset: 10, closeButton: false })
          .setHTML(popupHtml);

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([harbour.location.lng, harbour.location.lat])
          .setPopup(popup)
          .addTo(map);

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          popup.addTo(map);
        });

        markersRef.current.push(marker);
      }
    });

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleListingHover(id: string | null) {
    setHoveredListingId(id);

    if (!id || !mapRef.current) return;
    const listing = listings.find((l) => l.id === id);
    if (!listing) return;

    mapRef.current.easeTo({
      center: [listing.mine_location.lng, listing.mine_location.lat],
      duration: 400,
    });
  }

  function handleListingClick(listing: ListingWithDetails) {
    if (!mapRef.current) return;
    mapRef.current.flyTo({
      center: [listing.mine_location.lng, listing.mine_location.lat],
      zoom: 8,
      duration: 1000,
    });
  }

  return (
    <div className="relative h-[calc(100vh-5rem)] -m-6 md:-m-10 overflow-hidden">
      {/* Full-width map behind everything */}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />

      {/* Left overlay: frosted glass listings panel */}
      <div className="absolute inset-y-0 left-0 w-2/5 min-w-0 flex flex-col z-10 bg-gray-950/85 backdrop-blur-xl border-r border-gray-800/50">
        <ListingsPanel
          listings={listings}
          hoveredListingId={hoveredListingId}
          onListingHover={handleListingHover}
          onListingClick={handleListingClick}
        />
      </div>

      {/* Legend overlay bottom-right of map area */}
      <div className="absolute bottom-8 right-3 z-10 bg-gray-950/80 border border-gray-700/50 rounded-lg p-3 space-y-2 text-xs backdrop-blur-md">
        <div className="text-gray-400 font-semibold uppercase tracking-wider mb-1">Legend</div>
        {(Object.entries(COMMODITY_CONFIG) as [CommodityType, { label: string; color: string }][]).map(
          ([, config]) => (
            <div key={config.label} className="flex items-center gap-2 text-gray-300">
              <span
                className="w-2.5 h-2.5 rounded-full flex-none"
                style={{ backgroundColor: config.color }}
              />
              {config.label}
            </div>
          )
        )}
        <div className="flex items-center gap-2 text-gray-300 pt-1 border-t border-gray-700/50">
          <span className="w-2.5 h-2.5 rounded flex-none bg-emerald-500" />
          Harbour
        </div>
      </div>
    </div>
  );
}
