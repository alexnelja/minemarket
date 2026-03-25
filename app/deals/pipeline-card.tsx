import Link from 'next/link';
import { COMMODITY_CONFIG } from '@/lib/types';
import { formatCurrency, timeAgo } from '@/lib/format';
import { CommodityDot } from '@/app/components/commodity-dot';
import { StatusBadge } from '@/app/components/status-badge';
import type { DealWithDetails } from '@/lib/deal-queries';

interface PipelineCardProps {
  deal: DealWithDetails;
}

export function PipelineCard({ deal }: PipelineCardProps) {
  const config = COMMODITY_CONFIG[deal.commodity_type];

  return (
    <Link
      href={`/deals/${deal.id}`}
      className="block bg-gray-950 border border-gray-800 rounded-lg p-3 hover:border-gray-700 transition-colors"
    >
      <div className="flex items-center gap-2 mb-2">
        <CommodityDot commodity={deal.commodity_type} size="sm" />
        <span className="text-xs font-medium text-white">{config.label}</span>
        <span className="ml-auto">
          <StatusBadge status={deal.status} />
        </span>
      </div>
      <div className="text-xs text-gray-400">{deal.counterparty_name}</div>
      <div className="flex items-center justify-between mt-2">
        <span className="text-sm font-semibold text-amber-500">
          {formatCurrency(deal.agreed_price, deal.currency)}/t
        </span>
        <span className="text-xs text-gray-500">
          {deal.volume_tonnes.toLocaleString()}t
        </span>
      </div>
      <div className="text-[10px] text-gray-600 mt-1">{timeAgo(deal.created_at)}</div>
    </Link>
  );
}
