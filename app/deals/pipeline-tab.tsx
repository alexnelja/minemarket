import { PIPELINE_COLUMNS } from '@/lib/deal-helpers';
import { PipelineCard } from './pipeline-card';
import type { DealWithDetails } from '@/lib/deal-queries';

interface PipelineTabProps {
  deals: DealWithDetails[];
}

export function PipelineTab({ deals }: PipelineTabProps) {
  return (
    <div className="relative overflow-x-auto pb-4">
    <div className="flex gap-4 pr-6 min-w-[1200px]">
      {PIPELINE_COLUMNS.map((column) => {
        const columnDeals = deals.filter((d) => column.statuses.includes(d.status));
        return (
          <div key={column.key} className="flex-shrink-0 w-64">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {column.label}
              </h3>
              <span className="text-xs text-gray-600 bg-gray-800 rounded-full px-2 py-0.5">
                {columnDeals.length}
              </span>
            </div>
            <div className="space-y-2">
              {columnDeals.length === 0 ? (
                <div className="text-xs text-gray-600 text-center py-6 border border-dashed border-gray-800 rounded-lg">
                  No deals
                </div>
              ) : (
                columnDeals.map((deal) => (
                  <PipelineCard key={deal.id} deal={deal} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
    {/* Scroll indicator */}
    <div className="absolute top-0 right-0 bottom-0 w-8 bg-gradient-to-l from-gray-950 to-transparent pointer-events-none" />
    </div>
  );
}
