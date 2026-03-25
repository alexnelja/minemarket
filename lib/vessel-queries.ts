import { createAdminSupabaseClient } from './supabase-server';

export interface VesselPosition {
  mmsi: string;
  name: string;
  lat: number;
  lng: number;
  speed: number;
  course: number;
  heading: number;
  ship_type: number;
  destination: string | null;
  eta: string | null;
  last_seen: string;
}

export interface PortCongestion {
  harbour_id: string;
  harbour_name: string;
  harbour_country: string;
  vessels_at_port: number;
  vessels_anchored: number;
  vessels_approaching: number;
  congestion_level: string;
  last_calculated: string;
}

export async function getVesselPositions(bbox?: { lat1: number; lng1: number; lat2: number; lng2: number }): Promise<VesselPosition[]> {
  const admin = createAdminSupabaseClient();
  let query = admin
    .from('vessel_positions')
    .select('*')
    .order('last_seen', { ascending: false })
    .limit(1000);

  if (bbox) {
    query = query
      .gte('lat', Math.min(bbox.lat1, bbox.lat2))
      .lte('lat', Math.max(bbox.lat1, bbox.lat2))
      .gte('lng', Math.min(bbox.lng1, bbox.lng2))
      .lte('lng', Math.max(bbox.lng1, bbox.lng2));
  }

  const { data } = await query;
  return (data ?? []) as VesselPosition[];
}

export async function getPortCongestion(): Promise<PortCongestion[]> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from('port_congestion')
    .select('*, harbours!harbour_id(name, country)')
    .order('vessels_at_port', { ascending: false })
    .limit(50);

  return (data ?? []).map((row: Record<string, unknown>) => {
    const harbour = row.harbours as Record<string, unknown> | null;
    return {
      harbour_id: row.harbour_id as string,
      harbour_name: (harbour?.name as string) ?? 'Unknown',
      harbour_country: (harbour?.country as string) ?? '',
      vessels_at_port: (row.vessels_at_port as number) ?? 0,
      vessels_anchored: (row.vessels_anchored as number) ?? 0,
      vessels_approaching: (row.vessels_approaching as number) ?? 0,
      congestion_level: (row.congestion_level as string) ?? 'low',
      last_calculated: (row.last_calculated as string) ?? '',
    };
  });
}
