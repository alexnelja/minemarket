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
}

export function StatsRow({ stats, currency }: StatsRowProps) {
  const cards = [
    {
      label: 'Avg Ask Price',
      value: stats.avgAskPrice > 0 ? `${formatCurrency(stats.avgAskPrice, currency)}/t` : '—',
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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-gray-900 border border-gray-800 rounded-xl p-4"
        >
          <p className="text-xs text-gray-500 mb-1">{card.label}</p>
          <p className="text-lg font-bold text-white">{card.value}</p>
          {card.sublabel && (
            <p className="text-xs text-gray-500 mt-0.5">{card.sublabel}</p>
          )}
        </div>
      ))}
    </div>
  );
}
