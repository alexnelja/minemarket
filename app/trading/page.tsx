import { COMMODITY_CONFIG } from '@/lib/types';
import type { CommodityType } from '@/lib/types';
import { getTradingStats, getCompletedDeals } from '@/lib/deal-queries';
import { getCommodityPriceForDisplay } from '@/lib/commodity-prices';
import { calculatePriceWaterfall } from '@/lib/price-waterfall';
import { PriceWaterfallChart } from '@/app/components/price-waterfall-chart';
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
        indexPeriod={indexData?.period}
        indexTrend={indexData?.trend}
      />

      {/* Price chart */}
      <PriceChart data={stats.priceHistory} color={config.color} />

      {/* Price Breakdown — CIF to mine gate waterfall for this commodity */}
      {indexData?.price && indexData.price > 0 && (() => {
        const waterfall = calculatePriceWaterfall({
          cifPrice: indexData.price,
          commodity,
          volumeTonnes: 50000,
          loadingPort: 'Richards Bay',
          loadingPortCoords: { lat: -28.801, lng: 32.038 },
          destinationCoords: { lat: 36.067, lng: 120.383 }, // Qingdao
          transportMode: 'rail',
        });
        return (
          <div>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Price Breakdown
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              CIF to mine gate waterfall for {config.label} at current index (Richards Bay → Qingdao, 50kt Supramax)
            </p>
            <PriceWaterfallChart waterfall={waterfall} />
          </div>
        );
      })()}

      {/* Recent deals */}
      <RecentDealsTable deals={completedDeals} avgPrice={stats.avgAskPrice} />
    </div>
  );
}
