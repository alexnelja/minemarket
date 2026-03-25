'use client';

import { useState, useEffect, useCallback } from 'react';
import type { PortCongestion } from '@/lib/vessel-queries';
import type { MarineWeather } from '@/lib/marine-weather';
import { MarineWeatherCard } from './marine-weather-card';

const REFRESH_INTERVAL_MS = 60_000;

interface CongestionSidebarProps {
  initialCongestion: PortCongestion[];
  vesselCount: number;
  portWeather?: MarineWeather[];
}

function getCongestionBadge(level: string) {
  switch (level) {
    case 'high':
      return { label: 'High', className: 'bg-red-500/20 text-red-400' };
    case 'medium':
      return { label: 'Medium', className: 'bg-amber-500/20 text-amber-400' };
    default:
      return { label: 'Low', className: 'bg-green-500/20 text-green-400' };
  }
}

export function CongestionSidebar({ initialCongestion, vesselCount, portWeather = [] }: CongestionSidebarProps) {
  const [congestion, setCongestion] = useState(initialCongestion);
  const weatherMap = new Map(portWeather.map((w) => [w.harbourId, w]));

  const refreshCongestion = useCallback(async () => {
    try {
      const res = await fetch('/api/vessels/congestion');
      if (res.ok) {
        const data = await res.json();
        // Map the joined harbour data
        setCongestion(
          data.map((row: Record<string, unknown>) => {
            const harbour = row.harbours as Record<string, unknown> | null;
            return {
              harbour_id: row.harbour_id,
              harbour_name: harbour?.name ?? 'Unknown',
              harbour_country: harbour?.country ?? '',
              vessels_at_port: row.vessels_at_port ?? 0,
              vessels_anchored: row.vessels_anchored ?? 0,
              vessels_approaching: row.vessels_approaching ?? 0,
              congestion_level: row.congestion_level ?? 'low',
              last_calculated: row.last_calculated ?? '',
            };
          })
        );
      }
    } catch {
      // Keep stale data on error
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(refreshCongestion, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refreshCongestion]);

  return (
    <div className="w-full md:w-80 md:border-l border-gray-800 bg-gray-950 overflow-y-auto p-4 space-y-4">
      {/* Summary */}
      <div>
        <h2 className="text-sm font-semibold text-white">Live Vessel Tracking</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          {vesselCount} vessels from AIS data
        </p>
      </div>

      {/* Port congestion list */}
      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Port Congestion
        </h3>

        {congestion.length === 0 ? (
          <p className="text-xs text-gray-600 py-4 text-center">
            No congestion data yet. Data will populate once the vessel-tracker function runs.
          </p>
        ) : (
          <div className="space-y-1.5">
            {congestion.map((port) => {
              const badge = getCongestionBadge(port.congestion_level);
              return (
                <div
                  key={port.harbour_id}
                  className="bg-gray-900 rounded-lg px-3 py-2.5 border border-gray-800 hover:border-gray-700 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {port.harbour_name}
                      </p>
                      <p className="text-[10px] text-gray-500">{port.harbour_country}</p>
                    </div>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${badge.className} whitespace-nowrap`}>
                      {badge.label}
                    </span>
                  </div>
                  <div className="flex gap-4 mt-2 text-[10px] text-gray-400">
                    <div>
                      <span className="text-white font-medium">{port.vessels_at_port}</span> at port
                    </div>
                    <div>
                      <span className="text-white font-medium">{port.vessels_anchored}</span> anchored
                    </div>
                    <div>
                      <span className="text-white font-medium">{port.vessels_approaching}</span> inbound
                    </div>
                  </div>
                  {weatherMap.has(port.harbour_id) && (
                    <MarineWeatherCard
                      initialData={weatherMap.get(port.harbour_id)}
                      compact
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="border-t border-gray-800 pt-3">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Congestion Levels
        </h3>
        <div className="space-y-1 text-[10px] text-gray-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Low — normal traffic
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Medium — higher than average wait times
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            High — significant delays expected
          </div>
        </div>
      </div>
    </div>
  );
}
