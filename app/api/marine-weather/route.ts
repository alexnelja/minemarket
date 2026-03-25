import { NextRequest, NextResponse } from 'next/server';
import { getMarineWeather, getMarineWeatherForHarbours } from '@/lib/marine-weather';
import { createAdminSupabaseClient } from '@/lib/supabase-server';
import { parseGeoPoint } from '@/lib/geo';

export const revalidate = 3600; // cache for 1 hour

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const harbourId = searchParams.get('harbour_id');
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');

  try {
    // Batch mode: comma-separated harbour IDs
    if (harbourId && harbourId.includes(',')) {
      const ids = harbourId.split(',').map((s) => s.trim()).filter(Boolean);
      const results = await getMarineWeatherForHarbours(ids);
      return NextResponse.json(results);
    }

    // Single harbour by ID
    if (harbourId) {
      const admin = createAdminSupabaseClient();
      const { data: harbour, error } = await admin
        .from('harbours')
        .select('id, name, location')
        .eq('id', harbourId)
        .single();

      if (error || !harbour) {
        return NextResponse.json({ error: 'Harbour not found' }, { status: 404 });
      }

      const loc = parseGeoPoint(harbour.location);
      if (!loc) {
        return NextResponse.json({ error: 'Harbour has no valid coordinates' }, { status: 400 });
      }

      const weather = await getMarineWeather(loc.lat, loc.lng, harbour.id as string, harbour.name as string);
      return NextResponse.json(weather);
    }

    // Direct coordinates
    if (lat && lng) {
      const weather = await getMarineWeather(parseFloat(lat), parseFloat(lng));
      return NextResponse.json(weather);
    }

    return NextResponse.json(
      { error: 'Provide harbour_id or lat & lng query parameters' },
      { status: 400 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
