import { NextRequest, NextResponse } from 'next/server';
import { getTradingStats } from '@/lib/deal-queries';
import type { CommodityType } from '@/lib/types';

const VALID_COMMODITIES: CommodityType[] = ['chrome', 'manganese', 'iron_ore', 'coal', 'aggregates'];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const commodity = searchParams.get('commodity') as CommodityType | null;

  if (!commodity || !VALID_COMMODITIES.includes(commodity)) {
    return NextResponse.json({ error: 'Valid commodity parameter required' }, { status: 400 });
  }

  const stats = await getTradingStats(commodity);
  return NextResponse.json(stats);
}
