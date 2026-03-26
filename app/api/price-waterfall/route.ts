import { NextRequest, NextResponse } from 'next/server';
import { calculatePriceWaterfall } from '@/lib/price-waterfall';
import type { CommodityType } from '@/lib/types';

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const commodity = params.get('commodity') as CommodityType | null;
  const cifPriceRaw = params.get('cif_price');
  const volumeRaw = params.get('volume');
  const loadingPort = params.get('loading_port');
  const loadingLat = params.get('loading_lat');
  const loadingLng = params.get('loading_lng');
  const destLat = params.get('dest_lat');
  const destLng = params.get('dest_lng');

  if (!commodity || !cifPriceRaw || !loadingPort || !loadingLat || !loadingLng || !destLat || !destLng) {
    return NextResponse.json(
      { error: 'Missing required parameters: commodity, cif_price, loading_port, loading_lat, loading_lng, dest_lat, dest_lng' },
      { status: 400 },
    );
  }

  const cifPrice = parseFloat(cifPriceRaw);
  const volumeTonnes = parseFloat(volumeRaw ?? '50000');

  if (isNaN(cifPrice) || cifPrice <= 0) {
    return NextResponse.json({ error: 'cif_price must be a positive number' }, { status: 400 });
  }

  const mineLat = params.get('mine_lat');
  const mineLng = params.get('mine_lng');
  const transportMode = (params.get('transport_mode') as 'rail' | 'road') || 'rail';
  const storageDays = parseInt(params.get('storage_days') ?? '0', 10);
  const productionCostRaw = params.get('production_cost');
  const productionCost = productionCostRaw ? parseFloat(productionCostRaw) : undefined;

  const waterfall = calculatePriceWaterfall({
    cifPrice,
    commodity,
    volumeTonnes,
    loadingPort,
    loadingPortCoords: { lat: parseFloat(loadingLat), lng: parseFloat(loadingLng) },
    destinationCoords: { lat: parseFloat(destLat), lng: parseFloat(destLng) },
    mineCoords: mineLat && mineLng ? { lat: parseFloat(mineLat), lng: parseFloat(mineLng) } : undefined,
    transportMode,
    storageDays,
    productionCost,
  });

  return NextResponse.json(waterfall);
}
