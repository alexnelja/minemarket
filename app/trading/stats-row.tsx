import { formatCurrency, formatTonnes } from '@/lib/format';

interface TradingStats {
  avgAskPrice: number;
  avgBidPrice: number;
  spread: number;
  totalVolumeListed: number;
  activeDealsCount: number;
  totalDealValue: number;
}

interface StatsRowProps {
  stats: TradingStats;
  currency: string;
  indexPrice?: number;
  indexSource?: string;
  indexTrend?: { text: string; positive: boolean } | null;
}

export function StatsRow({ stats, currency, indexPrice, indexSource, indexTrend }: StatsRowProps) {
  const sourceLabel: Record<string, string> = {
    world_bank: 'World Bank',
    platform_deals: 'Platform avg',
    benchmark: 'Benchmark',
  };

  const cards = [
    {
      label: 'Avg Ask Price',
      value: stats.avgAskPrice > 0 ? `${formatCurrency(stats.avgAskPrice, currency)}/t` : '—',
    },
    {
      label: 'Index Price',
      value: indexPrice != null && indexPrice > 0
        ? `${formatCurrency(indexPrice, currency)}/t`
        : '—',
      sublabel: indexPrice != null && indexPrice > 0
        ? `${sourceLabel[indexSource ?? ''] ?? indexSource}${indexTrend ? ` ${indexTrend.text}` : ''}`
        : undefined,
      trendPositive: indexTrend?.positive,
    },
    {
      label: 'Volume Listed',
      value: stats.totalVolumeListed > 0 ? formatTonnes(stats.totalVolumeListed) : '—',
    },
    {
      label: 'Active Deals',
      value: stats.activeDealsCount > 0
        ? `${stats.activeDealsCount} (${formatCurrency(stats.totalDealValue, currency)})`
        : '—',
    },
    {
      label: 'Bid/Ask Spread',
      value: stats.avgBidPrice > 0 && stats.avgAskPrice > 0
        ? `${formatCurrency(stats.spread, currency)}`
        : '—',
      sublabel: stats.avgBidPrice > 0 && stats.avgAskPrice > 0
        ? (stats.spread > 0 ? 'Ask higher' : 'Bid higher')
        : undefined,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-gray-900 border border-gray-800 rounded-xl p-4"
        >
          <p className="text-xs text-gray-500 mb-1">{card.label}</p>
          <p className="text-lg font-bold text-white">{card.value}</p>
          {card.sublabel && (
            <p className={`text-xs mt-0.5 ${
              card.trendPositive === true ? 'text-emerald-400' :
              card.trendPositive === false ? 'text-red-400' :
              'text-gray-500'
            }`}>{card.sublabel}</p>
          )}
        </div>
      ))}
    </div>
  );
}
