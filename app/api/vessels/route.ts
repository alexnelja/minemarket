import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { searchParams } = new URL(request.url);

  const harbourId = searchParams.get('harbour_id');
  const bbox = searchParams.get('bbox'); // lat1,lng1,lat2,lng2
  const limit = Math.min(parseInt(searchParams.get('limit') || '500'), 2000);

  let query = supabase
    .from('vessel_positions')
    .select('*')
    .order('last_seen', { ascending: false })
    .limit(limit);

  if (harbourId) {
    query = query.eq('nearest_harbour_id', harbourId);
  }

  if (bbox) {
    const [lat1, lng1, lat2, lng2] = bbox.split(',').map(Number);
    query = query
      .gte('lat', Math.min(lat1, lat2))
      .lte('lat', Math.max(lat1, lat2))
      .gte('lng', Math.min(lng1, lng2))
      .lte('lng', Math.max(lng1, lng2));
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
