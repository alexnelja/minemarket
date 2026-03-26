import type { SupplyChainTimeline } from '@/lib/supply-chain-timeline';

const SEGMENT_COLORS: Record<string, string> = {
  mine_loading: '#f59e0b',
  inland_transit: '#f97316',
  stockpile_receival: '#a78bfa',
  quality_sampling: '#a78bfa',
  vessel_nomination: '#a78bfa',
  vessel_waiting: '#ef4444',
  vessel_loading: '#a78bfa',
  customs_export: '#6b7280',
  documentation: '#6b7280',
  ocean_transit: '#60a5fa',
  anchorage_wait: '#ef4444',
  discharge: '#10b981',
  customs_import: '#6b7280',
  lc_presentation: '#f59e0b',
  bank_processing: '#f59e0b',
  funds_receipt: '#10b981',
};

interface TimelineVisualProps {
  timeline: SupplyChainTimeline;
}

export function TimelineVisual({ timeline }: TimelineVisualProps) {
  const { segments, totalDays } = timeline;
  if (segments.length === 0) return null;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Supply Chain Timeline</h3>
        <span className="text-sm font-bold text-white">{totalDays} days total</span>
      </div>

      {/* Visual bar */}
      <div className="flex rounded-lg overflow-hidden h-8 mb-4">
        {segments.map((seg, i) => {
          const widthPct = (seg.durationDays / totalDays) * 100;
          const color = SEGMENT_COLORS[seg.segment] || '#6b7280';
          return (
            <div
              key={i}
              className="relative group"
              style={{ width: `${Math.max(widthPct, 2)}%`, backgroundColor: color }}
              title={`${seg.label}: ${seg.durationDays}d`}
            >
              {widthPct > 8 && (
                <span className="absolute inset-0 flex items-center justify-center text-[9px] text-black font-semibold">
                  {seg.durationDays}d
                </span>
              )}
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-gray-800 text-white text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10">
                {seg.label}: {seg.durationDays} days
              </div>
            </div>
          );
        })}
      </div>

      {/* Segment breakdown */}
      <div className="space-y-1.5">
        {segments.map((seg, i) => {
          const color = SEGMENT_COLORS[seg.segment] || '#6b7280';
          const methodLabel = seg.method === 'calculated' ? 'Calculated' : seg.method === 'estimated' ? 'Estimated' : 'Avg';
          const methodColor = seg.method === 'calculated' ? 'text-blue-400' : seg.method === 'estimated' ? 'text-amber-400' : 'text-gray-400';

          return (
            <div key={i} className="flex items-center gap-3 text-xs">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
              <span className="text-gray-300 flex-1">{seg.label}</span>
              <span className="text-white font-medium w-12 text-right">{seg.durationDays}d</span>
              <span className={`text-[10px] w-16 text-right ${methodColor}`}>{methodLabel}</span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-gray-800 text-[10px] text-gray-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: '#f97316' }} />Mine/Inland</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: '#a78bfa' }} />Port operations</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: '#ef4444' }} />Waiting time</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: '#60a5fa' }} />Ocean transit</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: '#10b981' }} />Discharge/Payment</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: '#6b7280' }} />Customs/Docs</span>
      </div>
    </div>
  );
}
