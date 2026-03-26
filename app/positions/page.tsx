import { requireAuth } from '@/lib/auth';
import { getDealsByUser } from '@/lib/deal-queries';
import { COMMODITY_CONFIG } from '@/lib/types';
import type { CommodityType } from '@/lib/types';
import { PositionClient } from './position-client';

export const metadata = {
  title: 'Position Book | MineMarket',
  description: 'Aggregate exposure across all your deals by commodity',
};

export default async function PositionsPage() {
  const user = await requireAuth();
  const deals = await getDealsByUser(user.id);

  // Compute positions by commodity
  const positions = computePositions(deals, user.id);

  return <PositionClient positions={positions} deals={deals} userId={user.id} />;
}

function computePositions(deals: any[], userId: string) {
  const byCommodity: Record<string, {
    commodity: CommodityType;
    label: string;
    color: string;
    buyVolume: number;
    sellVolume: number;
    netVolume: number;
    buyValue: number;
    sellValue: number;
    netValue: number;
    avgBuyPrice: number;
    avgSellPrice: number;
    dealCount: number;
    activeDeals: number;
    completedDeals: number;
    exposure: number;
  }> = {};

  for (const deal of deals) {
    const ct = deal.commodity_type as CommodityType;
    const config = COMMODITY_CONFIG[ct];
    if (!config) continue;

    if (!byCommodity[ct]) {
      byCommodity[ct] = {
        commodity: ct,
        label: config.label,
        color: config.color,
        buyVolume: 0, sellVolume: 0, netVolume: 0,
        buyValue: 0, sellValue: 0, netValue: 0,
        avgBuyPrice: 0, avgSellPrice: 0,
        dealCount: 0, activeDeals: 0, completedDeals: 0,
        exposure: 0,
      };
    }

    const pos = byCommodity[ct];
    const value = deal.agreed_price * deal.volume_tonnes;
    const isBuyer = deal.buyer_id === userId;
    const isTerminal = ['completed', 'cancelled'].includes(deal.status);

    pos.dealCount++;
    if (isTerminal) pos.completedDeals++;
    else pos.activeDeals++;

    if (isBuyer) {
      pos.buyVolume += deal.volume_tonnes;
      pos.buyValue += value;
    } else {
      pos.sellVolume += deal.volume_tonnes;
      pos.sellValue += value;
    }

    if (!isTerminal) {
      pos.exposure += value;
    }

    pos.netVolume = pos.buyVolume - pos.sellVolume;
    pos.netValue = pos.buyValue - pos.sellValue;
    pos.avgBuyPrice = pos.buyVolume > 0 ? pos.buyValue / pos.buyVolume : 0;
    pos.avgSellPrice = pos.sellVolume > 0 ? pos.sellValue / pos.sellVolume : 0;
  }

  return Object.values(byCommodity);
}
