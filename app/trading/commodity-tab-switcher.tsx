'use client';

import { useRouter } from 'next/navigation';
import { COMMODITY_CONFIG } from '@/lib/types';
import type { CommodityType } from '@/lib/types';

interface CommodityTabSwitcherProps {
  activeCommodity: CommodityType;
}

export function CommodityTabSwitcher({ activeCommodity }: CommodityTabSwitcherProps) {
  const router = useRouter();

  return (
    <>
      {/* Mobile: dropdown */}
      <div className="sm:hidden">
        <select
          value={activeCommodity}
          onChange={(e) => router.push(`/trading?commodity=${e.target.value}`)}
          className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white"
        >
          {(Object.entries(COMMODITY_CONFIG) as [CommodityType, { label: string; color: string }][]).map(
            ([type, config]) => (
              <option key={type} value={type}>{config.label}</option>
            )
          )}
        </select>
      </div>

      {/* Desktop: tabs */}
      <div className="hidden sm:flex gap-1 bg-gray-900 rounded-lg p-1 w-fit flex-wrap">
        {(Object.entries(COMMODITY_CONFIG) as [CommodityType, { label: string; color: string }][]).map(
          ([type, config]) => (
            <button
              key={type}
              onClick={() => router.push(`/trading?commodity=${type}`)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeCommodity === type
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: config.color }}
              />
              {config.label}
            </button>
          )
        )}
      </div>
    </>
  );
}
