import { NextRequest, NextResponse } from 'next/server';
import { estimateRoute } from '@/lib/distance';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { parseGeoPoint } from '@/lib/geo';

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  let fromLat: number;
  let fromLng: number;
  let toLat: number;
  let toLng: number;

  const fromHarbour = params.get('from_harbour');
  const toHarbour = params.get('to_harbour');

  if (fromHarbour || toHarbour) {
    // Look up harbour coordinates from the database
    const supabase = await createServerSupabaseClient();
    const harbourIds = [fromHarbour, toHarbour].filter(Boolean) as string[];
    const { data: harbours, error } = await supabase
      .from('harbours')
      .select('id, location')
      .in('id', harbourIds);

    if (error || !harbours) {
      return NextResponse.json({ error: 'Failed to look up harbours' }, { status: 500 });
    }

    const harbourMap = new Map(
      harbours.map((h) => {
        const loc = parseGeoPoint(h.location);
        return [h.id, loc];
      }),
    );

    if (fromHarbour) {
      const loc = harbourMap.get(fromHarbour);
      if (!loc) return NextResponse.json({ error: 'Origin harbour not found' }, { status: 404 });
      fromLat = loc.lat;
      fromLng = loc.lng;
    } else {
      fromLat = parseFloat(params.get('from_lat') ?? '');
      fromLng = parseFloat(params.get('from_lng') ?? '');
    }

    if (toHarbour) {
      const loc = harbourMap.get(toHarbour);
      if (!loc) return NextResponse.json({ error: 'Destination harbour not found' }, { status: 404 });
      toLat = loc.lat;
      toLng = loc.lng;
    } else {
      toLat = parseFloat(params.get('to_lat') ?? '');
      toLng = parseFloat(params.get('to_lng') ?? '');
    }
  } else {
    fromLat = parseFloat(params.get('from_lat') ?? '');
    fromLng = parseFloat(params.get('from_lng') ?? '');
    toLat = parseFloat(params.get('to_lat') ?? '');
    toLng = parseFloat(params.get('to_lng') ?? '');
  }

  const volume = parseFloat(params.get('volume') ?? '10000');

  if ([fromLat, fromLng, toLat, toLng].some(isNaN)) {
    return NextResponse.json(
      { error: 'Missing or invalid coordinates. Provide from_lat, from_lng, to_lat, to_lng (or harbour IDs) and optional volume.' },
      { status: 400 },
    );
  }

  const estimate = estimateRoute(fromLat, fromLng, toLat, toLng, volume);
  return NextResponse.json(estimate);
}
