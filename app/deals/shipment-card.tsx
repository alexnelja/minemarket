import Link from 'next/link';
import { COMMODITY_CONFIG } from '@/lib/types';
import { MILESTONE_ORDER, DEAL_STATUS_LABELS } from '@/lib/deal-helpers';
import { formatCurrency } from '@/lib/format';
import type { DealWithDetails } from '@/lib/deal-queries';
import type { DealMilestone, MilestoneType } from '@/lib/types';

interface ShipmentCardProps {
  deal: DealWithDetails;
  milestones: DealMilestone[];
  isSelected: boolean;
  onSelect: (dealId: string) => void;
}

export function ShipmentCard({ deal, milestones, isSelected, onSelect }: ShipmentCardProps) {
  const config = COMMODITY_CONFIG[deal.commodity_type];
  const completedTypes = new Set(milestones.map((m) => m.milestone_type));

  return (
    <div
      onClick={() => onSelect(deal.id)}
      className={`border rounded-lg p-3 cursor-pointer transition-colors ${
        isSelected
          ? 'bg-gray-800/50 border-gray-600'
          : 'bg-gray-950 border-gray-800 hover:border-gray-700'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: config.color }} />
        <span className="text-xs font-medium text-white">{config.label}</span>
        <span className="text-xs text-gray-500 ml-auto">{DEAL_STATUS_LABELS[deal.status]}</span>
      </div>
      <div className="text-xs text-gray-400 mb-1">
        {deal.mine_name} → {deal.harbour_name}
      </div>
      <div className="text-xs text-gray-400 mb-2">
        {formatCurrency(deal.agreed_price * deal.volume_tonnes, deal.currency)} · {deal.volume_tonnes.toLocaleString()}t
      </div>

      {/* Mini milestone bar */}
      <div className="flex gap-0.5">
        {MILESTONE_ORDER.map((step) => (
          <div
            key={step.type}
            className={`flex-1 h-1 rounded-full ${
              completedTypes.has(step.type as MilestoneType) ? 'bg-emerald-500' : 'bg-gray-700'
            }`}
          />
        ))}
      </div>

      <Link
        href={`/deals/${deal.id}`}
        className="text-[10px] text-gray-500 hover:text-gray-300 mt-2 block"
        onClick={(e) => e.stopPropagation()}
      >
        View details →
      </Link>
    </div>
  );
}
