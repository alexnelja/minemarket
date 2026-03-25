'use client';

import { useState, useEffect } from 'react';
import type { MarineWeather } from '@/lib/marine-weather';

interface MarineWeatherCardProps {
  harbourId?: string;
  /** Pre-fetched weather data (skips client fetch) */
  initialData?: MarineWeather;
  /** Compact mode for sidebar usage */
  compact?: boolean;
}

function seaStateBadge(state: MarineWeather['seaState']) {
  switch (state) {
    case 'calm':
      return { label: 'Calm', className: 'bg-green-500/20 text-green-400' };
    case 'moderate':
      return { label: 'Moderate', className: 'bg-amber-500/20 text-amber-400' };
    case 'rough':
      return { label: 'Rough', className: 'bg-red-500/20 text-red-400' };
    case 'very rough':
      return { label: 'Very Rough', className: 'bg-red-600/30 text-red-300' };
  }
}

/** Max wave height for chart scaling */
const CHART_MAX = 4;

function ForecastBars({ forecast }: { forecast: MarineWeather['forecast'] }) {
  // Show one bar per 6-hour window, max ~12 bars for 3 days
  return (
    <div className="flex items-end gap-px h-8 mt-2">
      {forecast.map((f, i) => {
        const pct = Math.min(f.waveHeight / CHART_MAX, 1) * 100;
        const color =
          f.waveHeight < 0.5
            ? 'bg-green-500'
            : f.waveHeight < 1.5
              ? 'bg-amber-500'
              : f.waveHeight < 2.5
                ? 'bg-red-400'
                : 'bg-red-600';
        return (
          <div
            key={i}
            className={`flex-1 rounded-t ${color} min-w-[3px]`}
            style={{ height: `${Math.max(pct, 4)}%` }}
            title={`${f.time}: ${f.waveHeight.toFixed(1)}m waves`}
          />
        );
      })}
    </div>
  );
}

export function MarineWeatherCard({ harbourId, initialData, compact = false }: MarineWeatherCardProps) {
  const [weather, setWeather] = useState<MarineWeather | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData && !!harbourId);

  useEffect(() => {
    if (initialData || !harbourId) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/marine-weather?harbour_id=${harbourId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data && !data.error) setWeather(data);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [harbourId, initialData]);

  if (loading) {
    return (
      <div className={`${compact ? '' : 'bg-gray-900 border border-gray-800 rounded-xl p-4'} animate-pulse`}>
        <div className="h-3 bg-gray-800 rounded w-24 mb-2" />
        <div className="h-2 bg-gray-800 rounded w-16" />
      </div>
    );
  }

  if (!weather) return null;

  const badge = seaStateBadge(weather.seaState);

  if (compact) {
    return (
      <div className="mt-1.5 pt-1.5 border-t border-gray-800/50">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[10px] text-gray-400">
            <span>{weather.waveHeight.toFixed(1)}m waves</span>
            <span className="text-gray-600">|</span>
            <span>{weather.swellHeight.toFixed(1)}m swell</span>
          </div>
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${badge.className} whitespace-nowrap`}>
            {badge.label}
          </span>
        </div>
        <ForecastBars forecast={weather.forecast} />
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Marine Weather {weather.harbourName ? `— ${weather.harbourName}` : ''}
        </h2>
        <span className={`text-xs font-medium px-2 py-0.5 rounded ${badge.className}`}>
          {badge.label}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-x-6 gap-y-3">
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Wave Height</p>
          <p className="text-sm text-white">{weather.waveHeight.toFixed(1)} m</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Wave Period</p>
          <p className="text-sm text-white">{weather.wavePeriod.toFixed(0)} s</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Wave Direction</p>
          <p className="text-sm text-white">{weather.waveDirection.toFixed(0)}&deg;</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Swell Height</p>
          <p className="text-sm text-white">{weather.swellHeight.toFixed(1)} m</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Swell Period</p>
          <p className="text-sm text-white">{weather.swellPeriod.toFixed(0)} s</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Wind Waves</p>
          <p className="text-sm text-white">{weather.windWaveHeight.toFixed(1)} m</p>
        </div>
      </div>

      {/* 3-day forecast */}
      <div>
        <p className="text-xs text-gray-500 mb-1">3-Day Wave Forecast</p>
        <ForecastBars forecast={weather.forecast} />
        <div className="flex justify-between mt-1 text-[10px] text-gray-600">
          <span>Now</span>
          <span>+3 days</span>
        </div>
      </div>
    </div>
  );
}
