import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { searchParams } = new URL(request.url);
  const country = searchParams.get('country');

  let stationQuery = supabase.from('rail_stations').select('*');
  let segmentCountQuery = supabase.from('rail_segments').select('id', { count: 'exact', head: true });

  if (country) {
    stationQuery = stationQuery.eq('country', country);
    segmentCountQuery = segmentCountQuery.eq('country', country);
  }

  const [stationResult, segmentResult] = await Promise.all([
    stationQuery,
    segmentCountQuery,
  ]);

  if (stationResult.error) {
    return NextResponse.json({ error: stationResult.error.message }, { status: 500 });
  }
  if (segmentResult.error) {
    return NextResponse.json({ error: segmentResult.error.message }, { status: 500 });
  }

  return NextResponse.json({
    stations: stationResult.data,
    segment_count: segmentResult.count ?? 0,
  });
}
