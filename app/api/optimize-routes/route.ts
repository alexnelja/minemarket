import { NextRequest, NextResponse } from 'next/server';
import { optimizeTransitRoutes } from '@/lib/route-optimizer';
import type { TradePoint } from '@/lib/forward-waterfall';
import type { CommodityType } from '@/lib/types';

const VALID_TRADE_POINTS: TradePoint[] = ['mine_gate', 'stockpile', 'port_gate', 'fob', 'cfr', 'cif'];

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const commodity = params.get('commodity') as CommodityType | null;
  const buyPriceRaw = params.get('buy_price');

  if (!commodity || !buyPriceRaw) {
    return NextResponse.json(
      { error: 'Missing required parameters: commodity, buy_price' },
      { status: 400 },
    );
  }

  const buyPrice = parseFloat(buyPriceRaw);
  if (isNaN(buyPrice) || buyPrice <= 0) {
    return NextResponse.json({ error: 'buy_price must be a positive number' }, { status: 400 });
  }

  const buyPointRaw = params.get('buy_point') as TradePoint | null;
  const sellPointRaw = params.get('sell_point') as TradePoint | null;
  const buyPoint: TradePoint = (buyPointRaw && VALID_TRADE_POINTS.includes(buyPointRaw)) ? buyPointRaw : 'mine_gate';
  const sellPoint: TradePoint = (sellPointRaw && VALID_TRADE_POINTS.includes(sellPointRaw)) ? sellPointRaw : 'cif';

  if (VALID_TRADE_POINTS.indexOf(sellPoint) <= VALID_TRADE_POINTS.indexOf(buyPoint)) {
    return NextResponse.json({ error: 'sell_point must come after buy_point in the corridor' }, { status: 400 });
  }

  const volumeTonnes = parseFloat(params.get('volume') ?? '15000');

  // Origin (mine) coordinates
  const originLat = params.get('origin_lat') || params.get('mine_lat');
  const originLng = params.get('origin_lng') || params.get('mine_lng');
  const originName = params.get('origin_name') || params.get('mine_name') || 'Mine';

  if (!originLat || !originLng) {
    return NextResponse.json(
      { error: 'Missing required parameters: origin_lat, origin_lng (mine coordinates)' },
      { status: 400 },
    );
  }

  const originCoords = { lat: parseFloat(originLat), lng: parseFloat(originLng) };

  // Destination coordinates — optional for FOB/port_gate/mine_gate sell points
  const destLat = params.get('dest_lat');
  const destLng = params.get('dest_lng');
  const destName = params.get('dest_name') || params.get('destination_name') || '';

  const needsDestination = ['cfr', 'cif'].includes(sellPoint);

  if (needsDestination && (!destLat || !destLng)) {
    return NextResponse.json(
      { error: 'Missing required parameters: dest_lat, dest_lng (destination coordinates) for CIF/CFR sell point' },
      { status: 400 },
    );
  }

  // For FOB sell points, destination is the SA port itself — use dummy coords (optimizer won't calculate ocean freight)
  const destinationCoords = destLat && destLng
    ? { lat: parseFloat(destLat), lng: parseFloat(destLng) }
    : { lat: 0, lng: 0 };

  // Index price: from param or try DB
  let indexCifPrice: number | undefined;
  const indexPriceRaw = params.get('index_price');
  if (indexPriceRaw) {
    indexCifPrice = parseFloat(indexPriceRaw);
  } else {
    try {
      const { createAdminSupabaseClient } = await import('@/lib/supabase-server');
      const supabase = createAdminSupabaseClient();
      const { data } = await supabase
        .from('commodity_prices')
        .select('price_usd')
        .eq('commodity', commodity)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .single();
      if (data?.price_usd) {
        indexCifPrice = data.price_usd;
      }
    } catch {
      // Ignore - indexCifPrice will be undefined
    }
  }

  // Grade (for chrome/manganese — adjusts effective index price)
  const gradeRaw = params.get('grade');
  const grade = gradeRaw ? parseFloat(gradeRaw) : undefined;

  const result = optimizeTransitRoutes({
    commodity,
    buyPrice,
    volumeTonnes,
    originCoords,
    originName,
    destinationCoords,
    destinationName: needsDestination ? (destName || 'Destination') : 'FOB at port',
    indexCifPrice,
    buyPoint,
    sellPoint,
    grade,
  });

  return NextResponse.json(result);
}
