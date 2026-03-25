'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { VesselPosition, PortCongestion } from '@/lib/vessel-queries';

const SHIP_TYPE_COLORS: Record<string, string> = {
  bulk: '#f59e0b',    // amber — bulk carriers (ship_type 70-79)
  tanker: '#3b82f6',  // blue — tankers (80-89)
  cargo: '#10b981',   // green — general cargo (70)
  container: '#8b5cf6', // violet — container ships
  other: '#6b7280',   // gray — everything else
};

function getShipColor(shipType: number | null): string {
  if (!shipType) return SHIP_TYPE_COLORS.other;
  if (shipType >= 80 && shipType <= 89) return SHIP_TYPE_COLORS.tanker;
  if (shipType >= 70 && shipType <= 79) return SHIP_TYPE_COLORS.bulk;
  return SHIP_TYPE_COLORS.other;
}

function getCongestionColor(level: string): string {
  switch (level) {
    case 'high': return '#ef4444';
    case 'medium': return '#f59e0b';
    default: return '#22c55e';
  }
}

const REFRESH_INTERVAL_MS = 60_000;

interface VesselMapProps {
  initialVessels: VesselPosition[];
  initialCongestion: PortCongestion[];
}

export function VesselMap({ initialVessels, initialCongestion }: VesselMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const [vessels, setVessels] = useState(initialVessels);
  const [congestion, setCongestion] = useState(initialCongestion);
  const [showVessels, setShowVessels] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Auto-refresh vessel data
  const refreshData = useCallback(async () => {
    try {
      const [vesselRes, congestionRes] = await Promise.all([
        fetch('/api/vessels?limit=1000'),
        fetch('/api/vessels/congestion'),
      ]);
      if (vesselRes.ok) {
        const data = await vesselRes.json();
        setVessels(data);
      }
      if (congestionRes.ok) {
        const data = await congestionRes.json();
        setCongestion(data);
      }
      setLastUpdated(new Date());
    } catch {
      // Silently fail on refresh — keep stale data
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(refreshData, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refreshData]);

  // Initialize map
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

  // Draw vessel markers
  useEffect(() => {
    if (!map.current) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (!showVessels) return;

    function addMarkers() {
      const m = map.current!;

      // Add vessel dots
      vessels.forEach((vessel) => {
        const color = getShipColor(vessel.ship_type);
        const el = document.createElement('div');
        el.style.cssText = `
          width: 8px; height: 8px;
          background: ${color};
          border-radius: 50%;
          border: 1px solid #0f172a;
          cursor: pointer;
          transition: transform 0.15s;
        `;
        el.addEventListener('mouseenter', () => {
          el.style.transform = 'scale(2)';
        });
        el.addEventListener('mouseleave', () => {
          el.style.transform = 'scale(1)';
        });

        const marker = new mapboxgl.Marker(el)
          .setLngLat([vessel.lng, vessel.lat])
          .addTo(m);

        el.addEventListener('click', () => {
          popupRef.current?.remove();

          const speed = vessel.speed != null ? `${vessel.speed.toFixed(1)} kn` : 'N/A';
          const course = vessel.course != null ? `${vessel.course.toFixed(0)}deg` : 'N/A';
          const ago = getTimeAgo(vessel.last_seen);

          const popup = new mapboxgl.Popup({ offset: 12, closeButton: true })
            .setLngLat([vessel.lng, vessel.lat])
            .setHTML(`
              <div style="color: #e5e7eb; font-size: 12px; line-height: 1.5; min-width: 160px;">
                <div style="font-weight: 600; font-size: 13px; color: white; margin-bottom: 4px;">${vessel.name || 'Unknown'}</div>
                <div style="color: #9ca3af;">MMSI: ${vessel.mmsi}</div>
                <div>Speed: <strong>${speed}</strong> | Course: <strong>${course}</strong></div>
                ${vessel.destination ? `<div>Dest: <strong>${vessel.destination}</strong></div>` : ''}
                ${vessel.eta ? `<div>ETA: <strong>${vessel.eta}</strong></div>` : ''}
                <div style="color: #6b7280; margin-top: 4px;">Updated ${ago}</div>
              </div>
            `)
            .addTo(m);

          popupRef.current = popup;
        });

        markersRef.current.push(marker);
      });

      // Add port congestion indicators
      congestion.forEach((port) => {
        const color = getCongestionColor(port.congestion_level);
        const el = document.createElement('div');
        const size = 16 + Math.min(port.vessels_at_port * 2, 24);
        el.style.cssText = `
          width: ${size}px; height: ${size}px;
          background: ${color}33;
          border: 2px solid ${color};
          border-radius: 50%;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          font-size: 10px; font-weight: 600; color: ${color};
        `;
        el.textContent = String(port.vessels_at_port);

        // We need harbour location — for now we skip if no coordinates
        // Port congestion markers require harbour geo data which we fetch separately
      });
    }

    if (map.current.isStyleLoaded()) {
      addMarkers();
    } else {
      map.current.on('style.load', addMarkers);
    }
  }, [vessels, congestion, showVessels]);

  return (
    <div className="absolute inset-0">
      <div ref={mapContainer} className="absolute inset-0" />

      {/* Controls overlay */}
      <div className="absolute top-3 left-3 flex flex-col gap-2 z-10">
        <button
          onClick={() => setShowVessels(!showVessels)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            showVessels
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              : 'bg-gray-800/80 text-gray-400 border border-gray-700'
          }`}
        >
          {showVessels ? 'Hide' : 'Show'} live vessels
        </button>

        <div className="bg-gray-900/90 rounded-lg px-3 py-2 text-[10px] text-gray-400 space-y-1 border border-gray-800">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: SHIP_TYPE_COLORS.bulk }} />
            Bulk carrier
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: SHIP_TYPE_COLORS.tanker }} />
            Tanker
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: SHIP_TYPE_COLORS.other }} />
            Other
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="absolute bottom-3 left-3 bg-gray-900/90 rounded-lg px-3 py-1.5 text-[10px] text-gray-500 border border-gray-800 z-10">
        {vessels.length} vessels tracked &middot; Updated {lastUpdated.toLocaleTimeString()}
      </div>

      {vessels.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-gray-950/80 px-6 py-4 rounded-lg text-center">
            <p className="text-gray-400 text-sm font-medium">No vessel data available</p>
            <p className="text-gray-600 text-xs mt-1">AIS data will appear once the vessel-tracker function is running</p>
          </div>
        </div>
      )}
    </div>
  );
}

function getTimeAgo(isoString: string): string {
  const seconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
