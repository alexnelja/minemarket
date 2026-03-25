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
  indexPeriod?: string;
  indexTrend?: { text: string; positive: boolean } | null;
}

export function StatsRow({ stats, currency, indexPrice, indexSource, indexPeriod, indexTrend }: StatsRowProps) {
  const sourceLabel: Record<string, string> = {
    world_bank: 'World Bank',
    platform_deals: 'Platform Avg',
    benchmark: 'Benchmark',
    lbma: 'LBMA Gold Price',
    lme: 'LME Official',
    lppm: 'LPPM Fix',
    api4: 'API4 Index',
  };

  function formatPeriod(period?: string): string {
    if (!period) return '';
    // Period is typically "2024-03" or ISO date string
    try {
      const d = new Date(period.length <= 7 ? `${period}-01` : period);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffHours < 24) return `Updated ${diffHours}h ago`;
      if (diffDays < 7) return `Updated ${diffDays}d ago`;
      return `Updated ${d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
    } catch {
      return `Updated ${period}`;
    }
  }

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
      meta: indexPrice != null && indexPrice > 0
        ? formatPeriod(indexPeriod)
        : undefined,
      trendPositive: indexTrend?.positive,
      highlight: true,
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
          className={`bg-gray-900 border rounded-xl p-4 ${
            card.highlight
              ? 'border-amber-500/30 ring-1 ring-amber-500/10'
              : 'border-gray-800'
          }`}
        >
          <p className="text-xs text-gray-500 mb-1">{card.label}</p>
          <p className={`font-bold ${
            card.highlight
              ? card.trendPositive === true ? 'text-emerald-400 text-xl' :
                card.trendPositive === false ? 'text-red-400 text-xl' :
                'text-white text-xl'
              : 'text-lg text-white'
          }`}>{card.value}</p>
          {card.sublabel && (
            <p className={`text-xs mt-0.5 ${
              card.trendPositive === true ? 'text-emerald-400' :
              card.trendPositive === false ? 'text-red-400' :
              'text-gray-500'
            }`}>{card.sublabel}</p>
          )}
          {card.meta && (
            <p className="text-[10px] text-gray-600 mt-0.5">{card.meta}</p>
          )}
        </div>
      ))}
    </div>
  );
}
