import { COMMODITY_CONFIG } from '@/lib/types';
import type { CommodityType } from '@/lib/types';

interface CommodityDotProps {
  commodity: CommodityType;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = { sm: 'w-2 h-2', md: 'w-2.5 h-2.5', lg: 'w-3 h-3' };

export function CommodityDot({ commodity, size = 'md', className = '' }: CommodityDotProps) {
  const config = COMMODITY_CONFIG[commodity];
  return (
    <span
      className={`rounded-full flex-shrink-0 ${SIZES[size]} ${className}`}
      style={{ backgroundColor: config?.color ?? '#6b7280' }}
    />
  );
}
