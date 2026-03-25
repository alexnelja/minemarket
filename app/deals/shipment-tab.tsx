'use client';

import { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { ShipmentCard } from './shipment-card';
import { COMMODITY_CONFIG } from '@/lib/types';
import type { DealWithDetails } from '@/lib/deal-queries';
import type { DealMilestone, GeoPoint } from '@/lib/types';

interface ShipmentTabProps {
  deals: DealWithDetails[];
  milestonesMap: Record<string, DealMilestone[]>;
  harbourLocations: Record<string, GeoPoint>;
  mineLocations: Record<string, GeoPoint>;
}

export function ShipmentTab({ deals, milestonesMap, harbourLocations, mineLocations }: ShipmentTabProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);

  // Filter to in-transit deals only
  const transitDeals = deals.filter((d) =>
    ['loading', 'in_transit', 'delivered'].includes(d.status)
  );

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [35, -10],
      zoom: 3,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'bottom-right');

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Draw deal routes and vessel positions
  useEffect(() => {
    if (!map.current) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    function addLayers() {
      const m = map.current!;

      // Remove existing layers
      if (m.getLayer('deal-routes')) m.removeLayer('deal-routes');
      if (m.getSource('deal-routes')) m.removeSource('deal-routes');

      // Build route features
      const features = transitDeals
        .map((deal) => {
          const mineLoc = mineLocations[deal.mine_name];
          const harbourLoc = harbourLocations[deal.harbour_name];
          if (!mineLoc || !harbourLoc) return null;

          const config = COMMODITY_CONFIG[deal.commodity_type];
          return {
            type: 'Feature' as const,
            properties: { color: config.color, dealId: deal.id },
            geometry: {
              type: 'LineString' as const,
              coordinates: [
                [mineLoc.lng, mineLoc.lat],
                [harbourLoc.lng, harbourLoc.lat],
              ],
            },
          };
        })
        .filter(Boolean);

      if (features.length > 0) {
        m.addSource('deal-routes', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: features as GeoJSON.Feature[] },
        });

        m.addLayer({
          id: 'deal-routes',
          type: 'line',
          source: 'deal-routes',
          paint: {
            'line-color': ['get', 'color'],
            'line-width': 2,
            'line-dasharray': [4, 3],
            'line-opacity': 0.7,
          },
        });
      }

      // Add pulsing vessel dots at midpoint of each route
      transitDeals.forEach((deal) => {
        const mineLoc = mineLocations[deal.mine_name];
        const harbourLoc = harbourLocations[deal.harbour_name];
        if (!mineLoc || !harbourLoc) return;

        // Estimate position along route based on milestones
        const milestones = milestonesMap[deal.id] ?? [];
        const progress = milestones.length / 6; // rough progress
        const lng = mineLoc.lng + (harbourLoc.lng - mineLoc.lng) * Math.min(progress, 0.95);
        const lat = mineLoc.lat + (harbourLoc.lat - mineLoc.lat) * Math.min(progress, 0.95);

        const config = COMMODITY_CONFIG[deal.commodity_type];
        const el = document.createElement('div');
        el.style.cssText = `
          width: 12px; height: 12px;
          background: ${config.color};
          border-radius: 50%;
          border: 2px solid #0f172a;
          box-shadow: 0 0 12px ${config.color}88;
          cursor: pointer;
          animation: pulse 2s ease-in-out infinite;
        `;

        const marker = new mapboxgl.Marker(el)
          .setLngLat([lng, lat])
          .addTo(m);

        markersRef.current.push(marker);

        el.addEventListener('click', () => setSelectedDealId(deal.id));
      });
    }

    if (map.current.isStyleLoaded()) {
      addLayers();
    } else {
      map.current.on('style.load', addLayers);
    }
  }, [transitDeals, mineLocations, harbourLocations, milestonesMap]);

  // Pan to selected deal
  useEffect(() => {
    if (!map.current || !selectedDealId) return;
    const deal = transitDeals.find((d) => d.id === selectedDealId);
    if (!deal) return;
    const harbourLoc = harbourLocations[deal.harbour_name];
    if (harbourLoc) {
      map.current.flyTo({ center: [harbourLoc.lng, harbourLoc.lat], zoom: 5, duration: 1000 });
    }
  }, [selectedDealId, transitDeals, harbourLocations]);

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-12rem)] -mx-6 md:-mx-10">
      {/* Map — hidden on mobile, shown on md+ */}
      <div className="hidden md:block flex-1 relative">
        <div ref={mapContainer} className="absolute inset-0" />
        {transitDeals.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-gray-500 text-sm bg-gray-950/80 px-4 py-2 rounded-lg">No active shipments</p>
          </div>
        )}
      </div>

      {/* Sidebar — full width on mobile, fixed width on desktop */}
      <div className="w-full md:w-72 md:border-l border-gray-800 bg-gray-950 overflow-y-auto p-3 space-y-2">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
          Active Shipments ({transitDeals.length})
        </h3>
        {transitDeals.map((deal) => (
          <ShipmentCard
            key={deal.id}
            deal={deal}
            milestones={milestonesMap[deal.id] ?? []}
            isSelected={selectedDealId === deal.id}
            onSelect={setSelectedDealId}
          />
        ))}
        {transitDeals.length === 0 && (
          <p className="text-xs text-gray-600 text-center py-8">
            Shipments will appear here when deals reach the loading stage.
          </p>
        )}
      </div>
    </div>
  );
}
