import { COMMODITY_CONFIG } from '@/lib/types';
import { timeAgo } from '@/lib/format';
import { CommodityDot } from '@/app/components/commodity-dot';
import type { Requirement } from '@/lib/types';

interface RequirementCardProps {
  requirement: Requirement;
}

export function RequirementCard({ requirement }: RequirementCardProps) {
  const config = COMMODITY_CONFIG[requirement.commodity_type];

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors h-full flex flex-col gap-3">
      {/* Header row */}
      <div className="flex items-center gap-2">
        <CommodityDot commodity={requirement.commodity_type} size="lg" />
        <span className="text-sm font-semibold text-white">{config.label}</span>
        <span className="text-xs text-gray-400 ml-1">wanted</span>
      </div>

      {/* Target price */}
      <div className="text-blue-400 text-xl font-bold">
        {requirement.currency} {requirement.target_price.toLocaleString()} / t
      </div>

      {/* Volume needed */}
      <div className="text-gray-300 text-sm">
        {requirement.volume_needed.toLocaleString()} t needed
      </div>

      {/* Delivery port + incoterm */}
      <div className="flex flex-wrap gap-2 text-sm text-gray-400">
        <span>Port: <span className="text-gray-200">{requirement.delivery_port}</span></span>
        <span className="text-xs bg-gray-800 text-gray-300 rounded px-2 py-0.5 border border-gray-700 self-center">
          {requirement.incoterm}
        </span>
      </div>

      {/* Footer */}
      <div className="mt-auto text-xs text-gray-500">
        {timeAgo(requirement.created_at)}
      </div>
    </div>
  );
}
