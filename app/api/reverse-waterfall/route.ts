import { NextResponse, type NextRequest } from 'next/server';
import { reverseWaterfall, getVerificationCheckpoints } from '@/lib/reverse-waterfall';
import type { TradePoint } from '@/lib/forward-waterfall';
import type { CommodityType } from '@/lib/types';

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  // Required
  const sellPriceRaw = params.get('sell_price');
  const commodity = params.get('commodity') as CommodityType;

  if (!sellPriceRaw || !commodity) {
    return NextResponse.json(
      { error: 'Missing required parameters: sell_price, commodity' },
      { status: 400 },
    );
  }

  const sellPrice = parseFloat(sellPriceRaw);
  if (isNaN(sellPrice) || sellPrice <= 0) {
    return NextResponse.json({ error: 'sell_price must be a positive number' }, { status: 400 });
  }

  // Trade points
  const sellPoint = (params.get('sell_point') || 'cif') as TradePoint;
  const buyPoint = (params.get('buy_point') || 'mine_gate') as TradePoint;

  // Volume
  const volumeTonnes = parseFloat(params.get('volume') || '15000');

  // Locations
  const loadingPort = params.get('loading_port') || 'Richards Bay';
  const loadingLat = parseFloat(params.get('loading_lat') || '-28.801');
  const loadingLng = parseFloat(params.get('loading_lng') || '32.038');

  const destLat = params.get('dest_lat');
  const destLng = params.get('dest_lng');
  const destName = params.get('dest_name') || '';

  const mineLat = params.get('mine_lat');
  const mineLng = params.get('mine_lng');
  const mineName = params.get('mine_name') || '';

  // Options
  const transportMode = (params.get('transport_mode') || 'rail') as 'rail' | 'road';
  const fxHedge = params.get('fx_hedge') || 'spot';
  const grade = params.get('grade') ? parseFloat(params.get('grade')!) : undefined;

  // Cost overrides
  const overrides: Record<string, number> = {};
  for (const [key, val] of params.entries()) {
    if (key.startsWith('override_') && val) {
      const overrideKey = key.replace('override_', '');
      const num = parseFloat(val);
      if (!isNaN(num) && num >= 0) {
        overrides[overrideKey] = num;
      }
    }
  }

  const result = reverseWaterfall({
    sellPrice,
    sellPoint,
    buyPoint,
    commodity,
    volumeTonnes,
    loadingPort,
    loadingPortCoords: { lat: loadingLat, lng: loadingLng },
    destinationCoords: destLat && destLng ? { lat: parseFloat(destLat), lng: parseFloat(destLng) } : undefined,
    destinationName: destName || undefined,
    mineCoords: mineLat && mineLng ? { lat: parseFloat(mineLat), lng: parseFloat(mineLng) } : undefined,
    mineName: mineName || undefined,
    transportMode,
    fxHedge: fxHedge as any,
    grade,
    overrides: Object.keys(overrides).length > 0 ? overrides : undefined,
  });

  // Verification checkpoints
  const checkpoints = getVerificationCheckpoints(buyPoint, sellPoint, commodity);

  return NextResponse.json({
    ...result,
    checkpoints,
    commodity,
    volumeTonnes,
    loadingPort,
    mineName,
    destinationName: destName,
    grade,
  });
}
