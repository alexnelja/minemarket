import { COMMODITY_CONFIG } from '@/lib/types';
import type { CommodityType } from '@/lib/types';
import { getTradingStats, getCompletedDeals } from '@/lib/deal-queries';
import { getCommodityPriceForDisplay } from '@/lib/commodity-prices';
import { StatsRow } from './stats-row';
import { PriceChart } from './price-chart';
import { RecentDealsTable } from './recent-deals-table';
import { CommodityTabSwitcher } from './commodity-tab-switcher';

interface TradingPageProps {
  searchParams: Promise<{ commodity?: string }>;
}

export default async function TradingPage({ searchParams }: TradingPageProps) {
  const params = await searchParams;
  const commodity = (params.commodity as CommodityType) || 'chrome';
  const config = COMMODITY_CONFIG[commodity];

  const [stats, completedDeals, indexData] = await Promise.all([
    getTradingStats(commodity),
    getCompletedDeals(commodity),
    getCommodityPriceForDisplay(commodity),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Trading</h1>
        <p className="text-gray-400 text-sm">Market data, price charts, and recent deals.</p>
      </div>

      {/* Commodity tabs */}
      <CommodityTabSwitcher activeCommodity={commodity} />

      {/* Stats */}
      <StatsRow
        stats={stats}
        currency="USD"
        indexPrice={indexData?.price}
        indexSource={indexData?.source}
        indexTrend={indexData?.trend}
      />

      {/* Price chart */}
      <PriceChart data={stats.priceHistory} color={config.color} />

      {/* Recent deals */}
      <RecentDealsTable deals={completedDeals} avgPrice={stats.avgAskPrice} />
    </div>
  );
}
