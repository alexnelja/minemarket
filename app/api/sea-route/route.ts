import { NextRequest, NextResponse } from 'next/server';
import { calculateSeaRoute } from '@/lib/sea-routes';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fromLat = parseFloat(searchParams.get('from_lat') || '');
  const fromLng = parseFloat(searchParams.get('from_lng') || '');
  const toLat = parseFloat(searchParams.get('to_lat') || '');
  const toLng = parseFloat(searchParams.get('to_lng') || '');
  const volume = parseInt(searchParams.get('volume') || '50000');

  if (isNaN(fromLat) || isNaN(fromLng) || isNaN(toLat) || isNaN(toLng)) {
    return NextResponse.json({ error: 'from_lat, from_lng, to_lat, to_lng are required' }, { status: 400 });
  }

  const result = calculateSeaRoute(
    { lat: fromLat, lng: fromLng },
    { lat: toLat, lng: toLng },
    volume,
  );

  return NextResponse.json(result);
}
