import { NextRequest, NextResponse } from 'next/server';
import { simulateDeal } from '@/lib/forward-waterfall';
import type { TradePoint } from '@/lib/forward-waterfall';
import type { CommodityType } from '@/lib/types';
import type { FxHedgeType } from '@/lib/price-waterfall';
import type { TradeFinancing } from '@/lib/forward-waterfall';
import { calculateTimeline } from '@/lib/supply-chain-timeline';

const VALID_TRADE_POINTS: TradePoint[] = ['mine_gate', 'stockpile', 'port_gate', 'fob', 'cfr', 'cif'];

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const commodity = params.get('commodity') as CommodityType | null;
  const volumeRaw = params.get('volume');
  const loadingPort = params.get('loading_port');
  const loadingLat = params.get('loading_lat');
  const loadingLng = params.get('loading_lng');
  const destLat = params.get('dest_lat');
  const destLng = params.get('dest_lng');

  // Buy/sell point parameters (new)
  const buyPointRaw = params.get('buy_point') as TradePoint | null;
  const sellPointRaw = params.get('sell_point') as TradePoint | null;
  const buyPriceRaw = params.get('buy_price');

  // Legacy parameter (backward compatible)
  const mineGatePriceRaw = params.get('mine_gate_price');

  // Resolve buy price: prefer buy_price, fall back to mine_gate_price
  const priceRaw = buyPriceRaw || mineGatePriceRaw;

  if (!commodity || !priceRaw || !loadingPort || !loadingLat || !loadingLng || !destLat || !destLng) {
    return NextResponse.json(
      { error: 'Missing required parameters: commodity, buy_price (or mine_gate_price), loading_port, loading_lat, loading_lng, dest_lat, dest_lng' },
      { status: 400 },
    );
  }

  const buyPrice = parseFloat(priceRaw);
  const volumeTonnes = parseFloat(volumeRaw ?? '15000');

  if (isNaN(buyPrice) || buyPrice <= 0) {
    return NextResponse.json({ error: 'Invalid buy price' }, { status: 400 });
  }

  if (isNaN(volumeTonnes) || volumeTonnes <= 0) {
    return NextResponse.json({ error: 'Invalid volume' }, { status: 400 });
  }

  // Validate trade points
  const buyPoint: TradePoint = (buyPointRaw && VALID_TRADE_POINTS.includes(buyPointRaw)) ? buyPointRaw : 'mine_gate';
  const sellPoint: TradePoint = (sellPointRaw && VALID_TRADE_POINTS.includes(sellPointRaw)) ? sellPointRaw : 'cif';

  if (VALID_TRADE_POINTS.indexOf(sellPoint) <= VALID_TRADE_POINTS.indexOf(buyPoint)) {
    return NextResponse.json({ error: 'sell_point must come after buy_point in the corridor' }, { status: 400 });
  }

  const destinationName = params.get('destination_name') || undefined;
  const mineLat = params.get('mine_lat');
  const mineLng = params.get('mine_lng');
  const mineName = params.get('mine_name') || undefined;
  const transportMode = (params.get('transport_mode') as 'rail' | 'road') || 'rail';
  const storageDays = parseInt(params.get('storage_days') ?? '0', 10);
  const fxHedge = (params.get('fx_hedge') as FxHedgeType) || 'spot';
  const hedgeCommodityPrice = params.get('hedge_commodity') === 'true';
  const dealCurrency = params.get('deal_currency') || 'USD';
  const dealDurationMonths = parseInt(params.get('deal_duration_months') ?? '3', 10);
  const indexCifPriceRaw = params.get('index_cif_price');

  // If no index price provided, try to fetch latest from commodity_prices
  let indexCifPrice: number | undefined;
  if (indexCifPriceRaw) {
    indexCifPrice = parseFloat(indexCifPriceRaw);
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
      // Ignore — indexCifPrice will be undefined
    }
  }

  // Parse financing params
  let financing: TradeFinancing | undefined;
  const lcCostPct = params.get('lc_cost_pct');
  const interestRatePct = params.get('interest_rate_pct');
  const financingDays = params.get('financing_days');
  const creditInsurancePct = params.get('credit_insurance_pct');

  if (lcCostPct || interestRatePct || creditInsurancePct) {
    financing = {
      lcCostPct: lcCostPct ? parseFloat(lcCostPct) : undefined,
      interestRatePct: interestRatePct ? parseFloat(interestRatePct) : undefined,
      financingDays: financingDays ? parseInt(financingDays, 10) : undefined,
      creditInsurancePct: creditInsurancePct ? parseFloat(creditInsurancePct) : undefined,
    };
  }

  const simulation = simulateDeal({
    buyPoint,
    sellPoint,
    buyPrice,
    commodity,
    volumeTonnes,
    loadingPort,
    loadingPortCoords: { lat: parseFloat(loadingLat), lng: parseFloat(loadingLng) },
    destinationCoords: { lat: parseFloat(destLat), lng: parseFloat(destLng) },
    destinationName,
    mineCoords: mineLat && mineLng ? { lat: parseFloat(mineLat), lng: parseFloat(mineLng) } : undefined,
    mineName,
    transportMode,
    storageDays,
    fxHedge,
    hedgeCommodityPrice,
    dealCurrency,
    dealDurationMonths,
    indexCifPrice,
    financing,
  });

  // Fetch dynamic supply chain data from platform DB
  const { createAdminSupabaseClient: createAdmin } = await import('@/lib/supabase-server');
  const admin = createAdmin();

  // Port congestion from AIS data
  let portCongestion: { level: string; vesselCount: number } | undefined;
  try {
    const { data: congestionData } = await admin
      .from('port_congestion')
      .select('vessels_at_port, vessels_anchored, congestion_level, harbours!harbour_id(name)')
      .limit(50);

    if (congestionData) {
      const match = congestionData.find((d: any) => {
        const h = d.harbours as any;
        return h?.name?.toLowerCase().includes(loadingPort.toLowerCase().split(' ')[0]);
      });
      if (match) {
        portCongestion = { level: match.congestion_level as string, vesselCount: match.vessels_at_port as number };
      }
    }
  } catch {
    // Non-critical — fall back to industry averages
  }

  // Average sea speed from AIS vessel positions
  let avgSeaSpeed: number | undefined;
  try {
    const { data: speedData } = await admin
      .from('vessel_positions')
      .select('speed')
      .gt('speed', 5)
      .lt('speed', 20)
      .gte('ship_type', 70)
      .lt('ship_type', 90)
      .limit(500);

    if (speedData && speedData.length > 20) {
      avgSeaSpeed = Math.round(
        speedData.reduce((s: number, v: any) => s + (v.speed as number), 0) / speedData.length * 10
      ) / 10;
    }
  } catch {
    // Non-critical — fall back to 13 knots default
  }

  // Calculate supply chain timeline with dynamic data
  const timeline = calculateTimeline({
    mineCoords: mineLat && mineLng ? { lat: parseFloat(mineLat), lng: parseFloat(mineLng) } : undefined,
    portCoords: { lat: parseFloat(loadingLat), lng: parseFloat(loadingLng) },
    destinationCoords: { lat: parseFloat(destLat), lng: parseFloat(destLng) },
    mineName,
    portName: loadingPort,
    destinationName,
    transportMode,
    volumeTonnes,
    buyPoint,
    sellPoint,
    includePaymentTimeline: true,
    portCongestion,
    averageSeaSpeed: avgSeaSpeed,
  });

  return NextResponse.json({ ...simulation, timeline });
}
