'use client';

import { useState } from 'react';
import { COMMODITY_CONFIG, CommodityType } from '@/lib/types';

export interface Filters {
  commodities: CommodityType[];
  verifiedOnly: boolean;
  priceMin: number | null;
  priceMax: number | null;
  volumeMin: number | null;
  incoterm: string | null;
}

interface FilterBarProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  listingCount: number;
}

const INCOTERMS = ['FOB', 'CIF', 'CFR'];

export function FilterBar({ filters, onFiltersChange, listingCount }: FilterBarProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const allCommodities = Object.keys(COMMODITY_CONFIG) as CommodityType[];

  function toggleCommodity(commodity: CommodityType) {
    const next = filters.commodities.includes(commodity)
      ? filters.commodities.filter((c) => c !== commodity)
      : [...filters.commodities, commodity];
    onFiltersChange({ ...filters, commodities: next });
  }

  function handlePriceMin(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value === '' ? null : Number(e.target.value);
    onFiltersChange({ ...filters, priceMin: val });
  }

  function handlePriceMax(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value === '' ? null : Number(e.target.value);
    onFiltersChange({ ...filters, priceMax: val });
  }

  function handleVolumeMin(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value === '' ? null : Number(e.target.value);
    onFiltersChange({ ...filters, volumeMin: val });
  }

  function handleIncoterm(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value === '' ? null : e.target.value;
    onFiltersChange({ ...filters, incoterm: val });
  }

  return (
    <div className="flex-none px-4 py-3 border-b border-gray-700/50 bg-gray-950/80 backdrop-blur-md space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Filters</span>
        <span className="text-xs text-gray-500">{listingCount} listing{listingCount !== 1 ? 's' : ''}</span>
      </div>

      {/* Commodity chips */}
      <div className="flex flex-wrap gap-1.5">
        {allCommodities.map((commodity) => {
          const config = COMMODITY_CONFIG[commodity];
          const active = filters.commodities.includes(commodity);
          return (
            <button
              key={commodity}
              onClick={() => toggleCommodity(commodity)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                active
                  ? 'border-transparent text-gray-900'
                  : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-300 bg-transparent'
              }`}
              style={active ? { backgroundColor: config.color, borderColor: config.color } : {}}
            >
              <span
                className="w-2 h-2 rounded-full flex-none"
                style={{ backgroundColor: config.color }}
              />
              {config.label}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="text-[10px] text-gray-500 hover:text-gray-300"
      >
        {showAdvanced ? 'Less filters \u25B4' : 'More filters \u25BE'}
      </button>
      {showAdvanced && (
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500">$/t</span>
            <input
              type="number"
              placeholder="Min"
              value={filters.priceMin ?? ''}
              onChange={handlePriceMin}
              className="w-16 bg-gray-800/70 border border-gray-700/60 rounded px-2 py-1 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-500"
            />
            <span className="text-xs text-gray-600">–</span>
            <input
              type="number"
              placeholder="Max"
              value={filters.priceMax ?? ''}
              onChange={handlePriceMax}
              className="w-16 bg-gray-800/70 border border-gray-700/60 rounded px-2 py-1 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-500"
            />
          </div>

          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500">Vol ≥</span>
            <input
              type="number"
              placeholder="t"
              value={filters.volumeMin ?? ''}
              onChange={handleVolumeMin}
              className="w-20 bg-gray-800/70 border border-gray-700/60 rounded px-2 py-1 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-500"
            />
          </div>

          <select
            value={filters.incoterm ?? ''}
            onChange={handleIncoterm}
            className="bg-gray-800/70 border border-gray-700/60 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-gray-500"
          >
            <option value="">All incoterms</option>
            {INCOTERMS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          {/* Verified toggle */}
          <label className="flex items-center gap-1.5 cursor-pointer">
            <div
              onClick={() => onFiltersChange({ ...filters, verifiedOnly: !filters.verifiedOnly })}
              className={`relative w-7 h-4 rounded-full transition-colors ${
                filters.verifiedOnly ? 'bg-emerald-500' : 'bg-gray-700'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${
                  filters.verifiedOnly ? 'translate-x-3' : 'translate-x-0'
                }`}
              />
            </div>
            <span className="text-xs text-gray-400">Verified</span>
          </label>
        </div>
      )}
    </div>
  );
}
