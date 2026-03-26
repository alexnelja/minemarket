import { createServerSupabaseClient, createAdminSupabaseClient } from './supabase-server';
import { parseGeoPoint } from './geo';
import type {
  Listing, MineWithGeo, HarbourWithGeo, ListingWithDetails,
  Requirement, GeoPoint,
} from './types';

export async function getHarbours(): Promise<HarbourWithGeo[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('harbours')
    .select('*');

  if (error || !data) return [];

  return data.map((h) => ({
    ...h,
    location: parseGeoPoint(h.location) ?? { lng: 0, lat: 0 },
  }));
}

export async function getMines(): Promise<MineWithGeo[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('mines')
    .select('*');

  if (error || !data) return [];

  return data.map((m) => ({
    ...m,
    location: parseGeoPoint(m.location) ?? { lng: 0, lat: 0 },
  }));
}

export async function getActiveListings(): Promise<ListingWithDetails[]> {
  const supabase = await createServerSupabaseClient();
  const admin = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from('listings')
    .select(`
      *,
      mines!source_mine_id (name, region, location),
      harbours!loading_port_id (name, location)
    `)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  // Fetch seller company names via admin client to bypass RLS
  const sellerIds = [...new Set(data.map((l: Record<string, unknown>) => l.seller_id as string))];
  const { data: sellers } = await admin
    .from('users')
    .select('id, company_name')
    .in('id', sellerIds);
  const sellerMap = new Map((sellers ?? []).map((s: { id: string; company_name: string }) => [s.id, s.company_name]));

  return data.map((l: Record<string, unknown>) => {
    const mine = l.mines as Record<string, unknown> | null;
    const harbour = l.harbours as Record<string, unknown> | null;

    return {
      ...l,
      mine_name: (mine?.name as string) ?? 'Not specified',
      mine_region: (mine?.region as string) ?? '',
      mine_location: parseGeoPoint(mine?.location) ?? { lng: 0, lat: 0 },
      harbour_name: (harbour?.name as string) ?? 'Unknown',
      harbour_location: parseGeoPoint(harbour?.location) ?? { lng: 0, lat: 0 },
      seller_company: sellerMap.get(l.seller_id as string) ?? 'Unknown',
    } as ListingWithDetails;
  });
}

export async function getActiveRequirements(): Promise<Requirement[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('requirements')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data as Requirement[];
}

export async function getListingById(id: string): Promise<ListingWithDetails | null> {
  const supabase = await createServerSupabaseClient();
  const admin = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from('listings')
    .select(`
      *,
      mines!source_mine_id (name, region, location),
      harbours!loading_port_id (name, location)
    `)
    .eq('id', id)
    .single();

  if (error || !data) return null;

  const mine = data.mines as Record<string, unknown> | null;
  const harbour = data.harbours as Record<string, unknown> | null;

  // Fetch seller company name via admin client to bypass RLS
  const { data: seller } = await admin
    .from('users')
    .select('company_name')
    .eq('id', data.seller_id as string)
    .single();

  return {
    ...data,
    mine_name: (mine?.name as string) ?? 'Not specified',
    mine_region: (mine?.region as string) ?? '',
    mine_location: parseGeoPoint(mine?.location) ?? { lng: 0, lat: 0 },
    harbour_name: (harbour?.name as string) ?? 'Unknown',
    harbour_location: parseGeoPoint(harbour?.location) ?? { lng: 0, lat: 0 },
    seller_company: (seller?.company_name as string) ?? 'Unknown',
  } as ListingWithDetails;
}

export interface RouteRow {
  origin_mine_id: string;
  harbour_id: string;
  transport_mode: string;
  route_geometry: string | null; // raw WKB hex from PostGIS, null if not set
  mine_location: GeoPoint;
  harbour_location: GeoPoint;
}

export async function getRoutes(): Promise<RouteRow[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('routes')
    .select(`
      origin_mine_id, harbour_id, transport_mode, route_geometry,
      mines!origin_mine_id (location),
      harbours!harbour_id (location)
    `);

  if (error || !data) return [];

  return data.map((r: Record<string, unknown>) => {
    const mine = r.mines as Record<string, unknown> | null;
    const harbour = r.harbours as Record<string, unknown> | null;
    return {
      origin_mine_id: r.origin_mine_id as string,
      harbour_id: r.harbour_id as string,
      transport_mode: (r.transport_mode as string) ?? 'road',
      route_geometry: (r.route_geometry as string | null) ?? null,
      mine_location: parseGeoPoint(mine?.location) ?? { lng: 0, lat: 0 },
      harbour_location: parseGeoPoint(harbour?.location) ?? { lng: 0, lat: 0 },
    };
  });
}

export async function getUserListings(userId: string): Promise<Listing[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('seller_id', userId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data as Listing[];
}

export async function getUserRequirements(userId: string): Promise<Requirement[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('requirements')
    .select('*')
    .eq('buyer_id', userId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data as Requirement[];
}
