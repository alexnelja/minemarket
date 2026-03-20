'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { COMMODITY_CONFIG } from '@/lib/types';
import type { CommodityType, CurrencyType } from '@/lib/types';

const INCOTERMS = ['FOB', 'CIF', 'CFR', 'EXW', 'DDP', 'FCA', 'DAP'] as const;
const CURRENCIES: CurrencyType[] = ['USD', 'ZAR', 'EUR'];

const INCOTERM_DESCRIPTIONS: Record<string, { short: string; context: 'loading' | 'delivery' }> = {
  FOB: { short: 'Free On Board — seller delivers to loading port', context: 'loading' },
  CIF: { short: 'Cost, Insurance & Freight — seller pays freight + insurance to destination', context: 'delivery' },
  CFR: { short: 'Cost & Freight — seller pays freight to destination, no insurance', context: 'delivery' },
  EXW: { short: 'Ex Works — buyer arranges all transport from mine', context: 'loading' },
  DDP: { short: 'Delivered Duty Paid — seller delivers to buyer\'s location, all costs', context: 'delivery' },
  FCA: { short: 'Free Carrier — seller delivers to carrier at named place', context: 'loading' },
  DAP: { short: 'Delivered At Place — seller delivers to destination, not unloaded', context: 'delivery' },
};

const SPEC_FIELDS: Record<CommodityType, { key: string; label: string }[]> = {
  chrome: [
    { key: 'cr2o3_pct', label: 'Cr₂O₃ (%)' },
    { key: 'fe_pct', label: 'Fe (%)' },
    { key: 'sio2_pct', label: 'SiO₂ (%)' },
    { key: 'moisture_pct', label: 'Moisture (%)' },
  ],
  manganese: [
    { key: 'mn_pct', label: 'Mn (%)' },
    { key: 'fe_pct', label: 'Fe (%)' },
    { key: 'sio2_pct', label: 'SiO₂ (%)' },
    { key: 'moisture_pct', label: 'Moisture (%)' },
  ],
  iron_ore: [
    { key: 'fe_pct', label: 'Fe (%)' },
    { key: 'sio2_pct', label: 'SiO₂ (%)' },
    { key: 'al2o3_pct', label: 'Al₂O₃ (%)' },
    { key: 'moisture_pct', label: 'Moisture (%)' },
  ],
  coal: [
    { key: 'cv_kcal', label: 'Calorific Value (kcal/kg)' },
    { key: 'ash_pct', label: 'Ash (%)' },
    { key: 'volatile_pct', label: 'Volatile Matter (%)' },
    { key: 'moisture_pct', label: 'Moisture (%)' },
  ],
  aggregates: [
    { key: 'particle_size_mm', label: 'Particle Size (mm)' },
    { key: 'density', label: 'Density (t/m³)' },
    { key: 'moisture_pct', label: 'Moisture (%)' },
  ],
};

export default function NewListingPage() {
  const router = useRouter();
  const [commodity, setCommodity] = useState<CommodityType | null>(null);
  const [price, setPrice] = useState('');
  const [volume, setVolume] = useState('');
  const [currency, setCurrency] = useState<CurrencyType>('USD');
  const [selectedIncoterms, setSelectedIncoterms] = useState<string[]>([]);
  const [specs, setSpecs] = useState<Record<string, string>>({});
  const [loadingPortName, setLoadingPortName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Fetch loading port name for the user's mine on mount (for incoterm display)
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from('mines')
        .select('nearest_harbour_id, harbours(name)')
        .eq('owner_id', user.id)
        .limit(1)
        .single()
        .then(({ data }) => {
          if (data) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const h = (data as any).harbours;
            if (h && typeof h === 'object' && 'name' in h) {
              setLoadingPortName(h.name as string);
            }
          }
        });
    });
  }, []);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!commodity) {
      setError('Please select a commodity type.');
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

      // Get first mine for this user (simplified v1)
      const { data: mines, error: minesError } = await supabase
        .from('mines')
        .select('id, nearest_harbour_id')
        .eq('owner_id', authUser.id)
        .limit(1);

      if (minesError || !mines || mines.length === 0) {
        setError('No mine found for your account. Please contact support.');
        return;
      }

      const mine = mines[0];

      // Build spec_sheet from filled-in values
      const spec_sheet: Record<string, number> = {};
      if (commodity) {
        for (const field of SPEC_FIELDS[commodity]) {
          const val = specs[field.key];
          if (val !== undefined && val !== '') {
            spec_sheet[field.key] = parseFloat(val);
          }
        }
      }

      const { error: insertError } = await supabase.from('listings').insert({
        seller_id: authUser.id,
        source_mine_id: mine.id,
        commodity_type: commodity,
        spec_sheet,
        volume_tonnes: parseFloat(volume),
        price_per_tonne: parseFloat(price),
        currency,
        incoterms: selectedIncoterms,
        loading_port_id: mine.nearest_harbour_id,
        is_verified: false,
        allocation_mode: 'open',
        max_buyers: null,
        preferred_buyer_ids: [],
        status: 'active',
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
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {(Object.entries(COMMODITY_CONFIG) as [CommodityType, { label: string; color: string }][]).map(
              ([type, cfg]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setCommodity(type);
                    setSpecs({});
                  }}
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
                  {cfg.label}
                </button>
              )
            )}
          </div>
        </div>

        {/* Price + Volume + Currency */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Price per tonne</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="e.g. 185.00"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Volume (tonnes)</label>
            <input
              type="number"
              min="0"
              step="1"
              value={volume}
              onChange={(e) => setVolume(e.target.value)}
              placeholder="e.g. 5000"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
            />
          </div>
        </div>

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

        {/* Commodity-specific spec fields */}
        {commodity && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Spec Sheet — {COMMODITY_CONFIG[commodity].label}
            </label>
            <div className="grid grid-cols-2 gap-4">
              {SPEC_FIELDS[commodity].map((field) => (
                <div key={field.key}>
                  <label className="block text-xs text-gray-500 mb-1">{field.label}</label>
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
            {submitting ? 'Creating…' : 'Create Listing'}
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
