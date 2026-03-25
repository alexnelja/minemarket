import { DEAL_STATUS_LABELS, DEAL_STATUS_COLORS } from '@/lib/deal-helpers';
import type { DealStatus } from '@/lib/types';

interface StatusBadgeProps {
  status: DealStatus;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const colors = DEAL_STATUS_COLORS[status];
  const label = DEAL_STATUS_LABELS[status];
  const sizeClass = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2.5 py-0.5';
  return (
    <span className={`${sizeClass} rounded-full border ${colors.bg} ${colors.text} ${colors.border}`}>
      {label}
    </span>
  );
}
