import { createAdminSupabaseClient } from './supabase-server';
import { parseGeoPoint } from './geo';

export interface MarineWeather {
  harbourId: string;
  harbourName: string;
  waveHeight: number;        // metres
  waveDirection: number;     // degrees
  wavePeriod: number;        // seconds
  swellHeight: number;       // metres
  swellDirection: number;    // degrees
  swellPeriod: number;       // seconds
  windWaveHeight: number;    // metres
  seaState: 'calm' | 'moderate' | 'rough' | 'very rough';
  forecast: { time: string; waveHeight: number; swellHeight: number }[];
}

interface OpenMeteoMarineResponse {
  hourly: {
    time: string[];
    wave_height: number[];
    wave_direction: number[];
    wave_period: number[];
    wind_wave_height: number[];
    swell_wave_height: number[];
    swell_wave_direction: number[];
    swell_wave_period: number[];
  };
}

function classifySeaState(waveHeight: number): MarineWeather['seaState'] {
  if (waveHeight < 0.5) return 'calm';
  if (waveHeight < 1.5) return 'moderate';
  if (waveHeight < 2.5) return 'rough';
  return 'very rough';
}

export async function getMarineWeather(
  lat: number,
  lng: number,
  harbourId = '',
  harbourName = '',
): Promise<MarineWeather> {
  const url = new URL('https://marine-api.open-meteo.com/v1/marine');
  url.searchParams.set('latitude', lat.toFixed(4));
  url.searchParams.set('longitude', lng.toFixed(4));
  url.searchParams.set(
    'hourly',
    'wave_height,wave_direction,wave_period,wind_wave_height,swell_wave_height,swell_wave_direction,swell_wave_period',
  );
  url.searchParams.set('forecast_days', '3');

  const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
  if (!res.ok) {
    throw new Error(`Open-Meteo marine API error: ${res.status}`);
  }

  const data: OpenMeteoMarineResponse = await res.json();
  const h = data.hourly;

  // Current conditions = first available reading
  const idx = 0;

  // Build 3-day forecast: one entry per 6 hours
  const forecast: MarineWeather['forecast'] = [];
  for (let i = 0; i < h.time.length; i += 6) {
    forecast.push({
      time: h.time[i],
      waveHeight: h.wave_height[i] ?? 0,
      swellHeight: h.swell_wave_height[i] ?? 0,
    });
  }

  return {
    harbourId,
    harbourName,
    waveHeight: h.wave_height[idx] ?? 0,
    waveDirection: h.wave_direction[idx] ?? 0,
    wavePeriod: h.wave_period[idx] ?? 0,
    swellHeight: h.swell_wave_height[idx] ?? 0,
    swellDirection: h.swell_wave_direction[idx] ?? 0,
    swellPeriod: h.swell_wave_period[idx] ?? 0,
    windWaveHeight: h.wind_wave_height[idx] ?? 0,
    seaState: classifySeaState(h.wave_height[idx] ?? 0),
    forecast,
  };
}

export async function getMarineWeatherForHarbours(
  harbourIds: string[],
): Promise<MarineWeather[]> {
  if (harbourIds.length === 0) return [];

  const admin = createAdminSupabaseClient();
  const { data: harbours } = await admin
    .from('harbours')
    .select('id, name, location')
    .in('id', harbourIds);

  if (!harbours || harbours.length === 0) return [];

  const results = await Promise.all(
    harbours.map(async (h) => {
      const loc = parseGeoPoint(h.location);
      if (!loc) return null;
      try {
        return await getMarineWeather(loc.lat, loc.lng, h.id as string, h.name as string);
      } catch {
        return null;
      }
    }),
  );

  return results.filter((r): r is MarineWeather => r !== null);
}
