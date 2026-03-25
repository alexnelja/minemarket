'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { COMMODITY_CONFIG, COMMODITY_PRICING } from '@/lib/types';
import type { CommodityType, CurrencyType } from '@/lib/types';
import { INCOTERMS, INCOTERM_DESCRIPTIONS } from '@/lib/incoterms';
import { SPEC_FIELDS } from '@/lib/spec-fields';
import { getSubtypesForCommodity, getSubtypeByKey } from '@/lib/commodity-subtypes';
import type { CommoditySubtype } from '@/lib/commodity-subtypes';
import type { PriceEstimate } from '@/lib/price-engine';

const CURRENCIES: CurrencyType[] = ['USD', 'ZAR', 'EUR'];

interface MineOption {
  id: string;
  name: string;
  region: string;
  commodities: string[];
  nearest_harbour_id: string;
  harbour_name: string | null;
}

const CONFIDENCE_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  high: { bg: 'bg-green-900/40', text: 'text-green-400', label: 'High confidence' },
  medium: { bg: 'bg-amber-900/40', text: 'text-amber-400', label: 'Medium confidence' },
  low: { bg: 'bg-red-900/40', text: 'text-red-400', label: 'Low confidence' },
};

export default function NewListingPage() {
  const router = useRouter();
  const [commodity, setCommodity] = useState<CommodityType | null>(null);
  const [selectedSubtype, setSelectedSubtype] = useState<string | null>(null);
  const [price, setPrice] = useState('');
  const [volume, setVolume] = useState('');
  const [currency, setCurrency] = useState<CurrencyType>('USD');
  const [selectedIncoterms, setSelectedIncoterms] = useState<string[]>([]);
  const [specs, setSpecs] = useState<Record<string, string>>({});
  const [loadingPortName, setLoadingPortName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [allMines, setAllMines] = useState<MineOption[]>([]);
  const [selectedMineId, setSelectedMineId] = useState<string | null>(null);

  // Commodity search state
  const [commoditySearch, setCommoditySearch] = useState('');

  // Price estimate state
  const [priceEstimate, setPriceEstimate] = useState<PriceEstimate | null>(null);
  const [estimating, setEstimating] = useState(false);

  // Get available subtypes for selected commodity
  const availableSubtypes: CommoditySubtype[] = commodity
    ? getSubtypesForCommodity(commodity)
    : [];

  // Get the active subtype config
  const subtypeConfig = selectedSubtype ? getSubtypeByKey(selectedSubtype) : null;

  // Determine which spec fields to show: prefer subtype-specific fields, fall back to commodity defaults
  const activeSpecFields = subtypeConfig
    ? subtypeConfig.specFields
    : commodity
      ? SPEC_FIELDS[commodity]
      : [];

  // Fetch all mines for this user on mount
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from('mines')
        .select('id, name, region, commodities, nearest_harbour_id, harbours(name)')
        .eq('owner_id', user.id)
        .then(({ data }) => {
          if (!data) return;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mines: MineOption[] = (data as any[]).map((m) => ({
            id: m.id,
            name: m.name,
            region: m.region,
            commodities: m.commodities ?? [],
            nearest_harbour_id: m.nearest_harbour_id,
            harbour_name: m.harbours && typeof m.harbours === 'object' && 'name' in m.harbours
              ? (m.harbours as { name: string }).name
              : null,
          }));
          setAllMines(mines);
          // Auto-select first mine if only one
          if (mines.length === 1) {
            setSelectedMineId(mines[0].id);
            setLoadingPortName(mines[0].harbour_name);
          }
        });
    });
  }, []);

  // Filter mines by selected commodity
  const availableMines = commodity
    ? allMines.filter((m) => m.commodities.includes(commodity))
    : allMines;

  // When selected mine changes, update loading port name
  function handleMineSelect(mineId: string) {
    setSelectedMineId(mineId);
    const mine = allMines.find((m) => m.id === mineId);
    setLoadingPortName(mine?.harbour_name ?? null);
  }

  // When commodity changes, reset mine selection if current mine doesn't support it
  function handleCommoditySelect(type: CommodityType) {
    setCommodity(type);
    setSpecs({});
    setSelectedSubtype(null);
    setPriceEstimate(null);
    const mine = allMines.find((m) => m.id === selectedMineId);
    if (mine && !mine.commodities.includes(type)) {
      setSelectedMineId(null);
      setLoadingPortName(null);
    }
  }

  function handleSubtypeSelect(subtypeKey: string) {
    setSelectedSubtype(subtypeKey);
    setSpecs({});
    setPriceEstimate(null);
  }

  function toggleIncoterm(term: string) {
    setSelectedIncoterms((prev) =>
      prev.includes(term) ? prev.filter((t) => t !== term) : [...prev, term]
    );
  }

  function handleSpecChange(key: string, value: string) {
    setSpecs((prev) => ({ ...prev, [key]: value }));
  }

  function getIncotermLabel(term: string): string {
    const desc = INCOTERM_DESCRIPTIONS[term];
    if (!desc) return term;
    if (desc.context === 'loading' && loadingPortName) {
      return `${term} ${loadingPortName}`;
    }
    return term;
  }

  // Price estimation
  async function handleEstimatePrice() {
    if (!commodity || !selectedSubtype) return;

    // Find the primary grade field from the subtype spec — use it if filled, otherwise omit
    // so the API uses the index grade as default
    const gradeField = activeSpecFields[0];
    const gradeValue = gradeField ? parseFloat(specs[gradeField.key] ?? '') : NaN;
    const hasGrade = !isNaN(gradeValue) && gradeValue > 0;

    setEstimating(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        commodity,
        subtype: selectedSubtype,
        ...(hasGrade ? { grade: String(gradeValue) } : {}),
        incoterm: selectedIncoterms[0] ?? 'FOB',
        loading_port: loadingPortName ?? '',
        volume: volume || '10000',
      });

      const res = await fetch(`/api/price-estimate?${params}`);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Failed to estimate price');
        return;
      }

      const estimate: PriceEstimate = await res.json();
      setPriceEstimate(estimate);
    } catch {
      setError('Failed to connect to price estimation service.');
    } finally {
      setEstimating(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!commodity) {
      setError('Please select a commodity type.');
      return;
    }
    if (!selectedMineId) {
      setError('Please select a mine.');
      return;
    }
    if (!price || !volume) {
      setError('Price and volume are required.');
      return;
    }
    if (selectedIncoterms.length === 0) {
      setError('Please select at least one incoterm.');
      return;
    }

    const priceNum = parseFloat(price);
    const volumeNum = parseFloat(volume);

    if (isNaN(priceNum) || priceNum <= 0) {
      setError('Price must be a positive number');
      return;
    }
    if (isNaN(volumeNum) || volumeNum <= 0) {
      setError('Volume must be a positive number');
      return;
    }

    // Validate spec sheet: no negative values for percentage fields
    for (const field of activeSpecFields) {
      const val = specs[field.key];
      if (val !== undefined && val !== '') {
        const num = parseFloat(val);
        if (isNaN(num) || num < 0) {
          setError(`${field.label} must be a non-negative number`);
          return;
        }
      }
    }

    setSubmitting(true);

    try {
      const supabase = createClient();
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

      if (authError || !authUser) {
        setError('You must be logged in to create a listing.');
        return;
      }

      // Ensure user profile exists (Fix 4)
      const { data: profile } = await supabase
        .from('users')
        .select('id')
        .eq('id', authUser.id)
        .single();

      if (!profile) {
        await supabase.from('users').insert({
          id: authUser.id,
          role: 'both',
          company_name: authUser.email?.split('@')[0] ?? 'Unknown',
          country: 'ZA',
        });
      }

      const mine = allMines.find((m) => m.id === selectedMineId);
      if (!mine) {
        setError('Selected mine not found. Please try again.');
        return;
      }

      // Build spec_sheet from filled-in values
      const spec_sheet: Record<string, number> = {};
      for (const field of activeSpecFields) {
        const val = specs[field.key];
        if (val !== undefined && val !== '') {
          spec_sheet[field.key] = parseFloat(val);
        }
      }

      const { error: insertError } = await supabase.from('listings').insert({
        seller_id: authUser.id,
        source_mine_id: mine.id,
        commodity_type: commodity,
        commodity_subtype: selectedSubtype,
        spec_sheet,
        volume_tonnes: volumeNum,
        price_per_tonne: priceNum,
        currency,
        incoterms: selectedIncoterms,
        loading_port_id: mine.nearest_harbour_id,
        is_verified: false,
        allocation_mode: 'open',
        max_buyers: null,
        preferred_buyer_ids: [],
        status: 'active',
        price_confidence: priceEstimate?.confidence ?? 'manual',
        price_breakdown: priceEstimate?.breakdown ?? null,
      });

      if (insertError) {
        setError(insertError.message);
        return;
      }

      router.push('/marketplace');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Listing</h1>
        <p className="text-gray-400 text-sm mt-1">Post a commodity lot for sale on the marketplace.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Commodity selector */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-3">Commodity</label>
          <input
            type="text"
            placeholder="Search commodities..."
            value={commoditySearch}
            onChange={(e) => setCommoditySearch(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 mb-3"
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {(Object.entries(COMMODITY_CONFIG) as [CommodityType, { label: string; color: string }][])
              .filter(([, cfg]) => cfg.label.toLowerCase().includes(commoditySearch.toLowerCase()))
              .map(
              ([type, cfg]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleCommoditySelect(type)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                    commodity === type
                      ? 'border-white text-white bg-gray-800'
                      : 'border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-200'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: cfg.color }}
                  />
                  <div className="text-left">
                    <div>{cfg.label}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{COMMODITY_PRICING[type]?.label}</div>
                  </div>
                </button>
              )
            )}
          </div>
        </div>

        {/* Subtype selector */}
        {commodity && availableSubtypes.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Subtype</label>
            <select
              value={selectedSubtype ?? ''}
              onChange={(e) => handleSubtypeSelect(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-500"
            >
              <option value="" disabled>Select a subtype...</option>
              {availableSubtypes.map((st) => (
                <option key={st.key} value={st.key}>
                  {st.label} ({st.gradeRange})
                </option>
              ))}
            </select>
            {subtypeConfig && (
              <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                <span>Use: {subtypeConfig.primaryUse}</span>
                <span>|</span>
                <span>Index: {subtypeConfig.priceIndex}</span>
              </div>
            )}
          </div>
        )}

        {/* Mine selector */}
        {availableMines.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Mine</label>
            <select
              value={selectedMineId ?? ''}
              onChange={(e) => handleMineSelect(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-500"
            >
              <option value="" disabled>Select a mine...</option>
              {availableMines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} — {m.region}{m.harbour_name ? ` (loading: ${m.harbour_name})` : ''}
                </option>
              ))}
            </select>
            {selectedMineId && loadingPortName && (
              <p className="mt-1 text-xs text-gray-500">Loading port auto-set to {loadingPortName}</p>
            )}
          </div>
        )}
        {commodity && availableMines.length === 0 && (
          <div className="bg-yellow-900/20 border border-yellow-800/50 text-yellow-300 text-sm rounded-lg px-4 py-3">
            No mines found for your account that produce {COMMODITY_CONFIG[commodity].label}. Please contact support.
          </div>
        )}

        {/* Price + Volume + Currency */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Price per tonne</label>
            <div className="flex gap-2">
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="e.g. 185.00"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
              />
            </div>
            {priceEstimate && (
              <div className="mt-1 flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full border ${CONFIDENCE_BADGE[priceEstimate.confidence].bg} ${CONFIDENCE_BADGE[priceEstimate.confidence].text} border-current`}>
                  {CONFIDENCE_BADGE[priceEstimate.confidence].label}
                </span>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Volume (tonnes)</label>
            <input
              type="number"
              min="0.01"
              step="1"
              value={volume}
              onChange={(e) => setVolume(e.target.value)}
              placeholder="e.g. 5000"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
            />
          </div>
        </div>

        {/* Estimate Price button */}
        {commodity && selectedSubtype && (
          <div>
            <button
              type="button"
              onClick={handleEstimatePrice}
              disabled={estimating}
              className="border border-blue-600 text-blue-400 hover:bg-blue-900/20 disabled:opacity-50 font-medium px-4 py-2 rounded-lg text-sm transition-colors"
            >
              {estimating ? 'Estimating...' : 'Estimate Price'}
            </button>

            {/* Price estimate breakdown */}
            {priceEstimate && (
              <div className="mt-3 bg-gray-900 border border-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white">Price Estimate</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${CONFIDENCE_BADGE[priceEstimate.confidence].bg} ${CONFIDENCE_BADGE[priceEstimate.confidence].text}`}>
                    {CONFIDENCE_BADGE[priceEstimate.confidence].label}
                  </span>
                </div>
                <div className="text-amber-400 text-lg font-bold mb-3">
                  ${priceEstimate.estimatedPrice.toLocaleString()} / t
                </div>
                <div className="space-y-1.5">
                  {priceEstimate.breakdown.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-gray-400">{item.label}</span>
                      <div className="text-right">
                        <span className="text-white">{item.value}</span>
                        <span className="text-gray-600 ml-2">{item.note}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setPrice(String(priceEstimate.estimatedPrice))}
                  className="mt-3 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Use this price
                </button>
              </div>
            )}
          </div>
        )}

        {/* Currency selector */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Currency</label>
          <div className="flex gap-2">
            {CURRENCIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCurrency(c)}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  currency === c
                    ? 'border-white text-white bg-gray-800'
                    : 'border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-200'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Incoterms multi-select with descriptions */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Incoterms</label>
          <div className="flex flex-wrap gap-2">
            {INCOTERMS.map((term) => {
              const isSelected = selectedIncoterms.includes(term);
              const desc = INCOTERM_DESCRIPTIONS[term];
              const showPort = desc?.context === 'loading' && loadingPortName;
              return (
                <button
                  key={term}
                  type="button"
                  onClick={() => toggleIncoterm(term)}
                  title={desc?.short}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    isSelected
                      ? 'border-amber-500 text-amber-400 bg-amber-900/20'
                      : 'border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-200'
                  }`}
                >
                  {showPort ? `${term} ${loadingPortName}` : term}
                </button>
              );
            })}
          </div>
          {selectedIncoterms.length > 0 && (
            <div className="mt-2 space-y-1">
              {selectedIncoterms.map((term) => {
                const desc = INCOTERM_DESCRIPTIONS[term];
                if (!desc) return null;
                const label = getIncotermLabel(term);
                return (
                  <p key={term} className="text-xs text-gray-400">
                    <span className="text-amber-400 font-medium">{label}</span>
                    {' — '}
                    {desc.short.split('—')[1]?.trim()}
                    {desc.context === 'loading' && loadingPortName && (
                      <span className="text-gray-500"> · at {loadingPortName}</span>
                    )}
                  </p>
                );
              })}
            </div>
          )}
          {!loadingPortName && selectedIncoterms.some((t) => INCOTERM_DESCRIPTIONS[t]?.context === 'loading') && (
            <p className="mt-1 text-xs text-gray-500">Loading port will be determined by your mine&apos;s nearest harbour.</p>
          )}
        </div>

        {/* Commodity-specific spec fields (from subtype or commodity default) */}
        {commodity && activeSpecFields.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Spec Sheet — {subtypeConfig?.label ?? COMMODITY_CONFIG[commodity].label}
            </label>
            <div className="grid grid-cols-2 gap-4">
              {activeSpecFields.map((field) => (
                <div key={field.key}>
                  <label className="block text-xs text-gray-500 mb-1">
                    {field.label}{('unit' in field && field.unit) ? ` (${field.unit})` : ''}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={specs[field.key] ?? ''}
                    onChange={(e) => handleSpecChange(field.key, e.target.value)}
                    placeholder="—"
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-900/30 border border-red-800 text-red-300 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors"
          >
            {submitting ? 'Creating...' : 'Create Listing'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600 font-medium px-6 py-2.5 rounded-lg text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
