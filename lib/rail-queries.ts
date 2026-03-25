import { createServerSupabaseClient } from './supabase-server';

export interface RailStation {
  id: string;
  name: string | null;
  lat: number;
  lng: number;
  country: string | null;
  infra_type: string | null;
  facility_type: string | null;
  source: string;
  last_verified_at: string;
}

export interface RailSegment {
  id: string;
  from_station_id: string | null;
  to_station_id: string | null;
  country: string | null;
  length_km: number | null;
  source: string;
}

export async function getRailStations(country?: string): Promise<RailStation[]> {
  const supabase = await createServerSupabaseClient();
  let query = supabase.from('rail_stations').select('*');

  if (country) {
    query = query.eq('country', country);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch rail stations: ${error.message}`);
  return data ?? [];
}

export async function getRailSegments(country?: string): Promise<RailSegment[]> {
  const supabase = await createServerSupabaseClient();
  let query = supabase.from('rail_segments').select('*');

  if (country) {
    query = query.eq('country', country);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch rail segments: ${error.message}`);
  return data ?? [];
}
