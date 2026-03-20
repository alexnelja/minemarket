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

interface Harbour {
  id: string;
  name: string;
  country: string;
  type: string;
}

export default function NewRequirementPage() {
  const router = useRouter();
  const [commodity, setCommodity] = useState<CommodityType | null>(null);
  const [targetPrice, setTargetPrice] = useState('');
  const [volume, setVolume] = useState('');
  const [deliveryPort, setDeliveryPort] = useState('');
  const [deliveryPortName, setDeliveryPortName] = useState('');
  const [portSearch, setPortSearch] = useState('');
  const [showPortDropdown, setShowPortDropdown] = useState(false);
  const [currency, setCurrency] = useState<CurrencyType>('USD');
  const [incoterm, setIncoterm] = useState('');
  const [harbours, setHarbours] = useState<Harbour[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Fetch harbours on mount
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('harbours')
      .select('id, name, country, type')
      .order('name')
      .then(({ data }) => {
        if (data) setHarbours(data);
      });
  }, []);

  // Group harbours for display
  const zaHarbours = harbours.filter((h) => h.country === 'ZA');
  const globalHarbours = harbours.filter((h) => h.country !== 'ZA');

  const filteredZA = portSearch
    ? zaHarbours.filter((h) => h.name.toLowerCase().includes(portSearch.toLowerCase()))
    : zaHarbours;
  const filteredGlobal = portSearch
    ? globalHarbours.filter((h) => h.name.toLowerCase().includes(portSearch.toLowerCase()))
    : globalHarbours;

  const selectedIncoDesc = incoterm ? INCOTERM_DESCRIPTIONS[incoterm] : null;

  function getIncotermHelperText(): string | null {
    if (!incoterm || !selectedIncoDesc) return null;
    if (selectedIncoDesc.context === 'delivery' && deliveryPortName) {
      return `${incoterm} — ${selectedIncoDesc.short.split('—')[1].trim()} · Port: ${deliveryPortName}`;
    }
    if (selectedIncoDesc.context === 'loading') {
      return `${incoterm} — ${selectedIncoDesc.short.split('—')[1].trim()}`;
    }
    return `${incoterm} — ${selectedIncoDesc.short.split('—')[1].trim()}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!commodity) {
      setError('Please select a commodity type.');
      return;
    }
    if (!targetPrice || !volume) {
      setError('Target price and volume are required.');
      return;
    }
    if (!deliveryPort.trim()) {
      setError('Delivery port is required.');
      return;
    }
    if (!incoterm) {
      setError('Please select an incoterm.');
      return;
    }

    setSubmitting(true);

    try {
      const supabase = createClient();
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

      if (authError || !authUser) {
        setError('You must be logged in to post a requirement.');
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

      const { error: insertError } = await supabase.from('requirements').insert({
        buyer_id: authUser.id,
        commodity_type: commodity,
        target_spec_range: {},
        volume_needed: parseFloat(volume),
        target_price: parseFloat(targetPrice),
        currency,
        delivery_port: deliveryPortName || deliveryPort.trim(),
        incoterm,
        status: 'active',
      });

      if (insertError) {
        setError(insertError.message);
        return;
      }

      router.push('/marketplace?tab=requirements');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Requirement</h1>
        <p className="text-gray-400 text-sm mt-1">Post what commodity you&apos;re looking to buy.</p>
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
                  onClick={() => setCommodity(type)}
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

        {/* Target price + Volume */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Target price per tonne</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              placeholder="e.g. 175.00"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Volume needed (tonnes)</label>
            <input
              type="number"
              min="0"
              step="1"
              value={volume}
              onChange={(e) => setVolume(e.target.value)}
              placeholder="e.g. 3000"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
            />
          </div>
        </div>

        {/* Delivery port — searchable dropdown from harbours DB */}
        <div className="relative">
          <label className="block text-sm font-medium text-gray-300 mb-1">Delivery Port</label>
          <input
            type="text"
            value={portSearch || deliveryPortName}
            onChange={(e) => {
              setPortSearch(e.target.value);
              setDeliveryPortName('');
              setDeliveryPort('');
              setShowPortDropdown(true);
            }}
            onFocus={() => setShowPortDropdown(true)}
            onBlur={() => setTimeout(() => setShowPortDropdown(false), 150)}
            placeholder="Search for a port…"
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
          />
          {showPortDropdown && (filteredZA.length > 0 || filteredGlobal.length > 0) && (
            <div className="absolute z-20 mt-1 w-full bg-gray-900 border border-gray-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
              {filteredZA.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-800/60">
                    Loading Ports — South Africa
                  </div>
                  {filteredZA.map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      onMouseDown={() => {
                        setDeliveryPort(h.id);
                        setDeliveryPortName(h.name);
                        setPortSearch('');
                        setShowPortDropdown(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-800 transition-colors"
                    >
                      {h.name}
                      <span className="ml-2 text-xs text-gray-500">{h.type}</span>
                    </button>
                  ))}
                </div>
              )}
              {filteredGlobal.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-800/60">
                    Destination Ports — Global
                  </div>
                  {filteredGlobal.map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      onMouseDown={() => {
                        setDeliveryPort(h.id);
                        setDeliveryPortName(h.name);
                        setPortSearch('');
                        setShowPortDropdown(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-800 transition-colors"
                    >
                      {h.name}
                      <span className="ml-2 text-xs text-gray-500">{h.country}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {deliveryPortName && (
            <p className="mt-1 text-xs text-emerald-400">Selected: {deliveryPortName}</p>
          )}
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

        {/* Incoterm single-select with descriptions */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Incoterm</label>
          <div className="flex flex-wrap gap-2">
            {INCOTERMS.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => setIncoterm(term)}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  incoterm === term
                    ? 'border-blue-500 text-blue-400 bg-blue-900/20'
                    : 'border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-200'
                }`}
              >
                {term}
              </button>
            ))}
          </div>
          {incoterm && (
            <p className="mt-2 text-xs text-gray-400">
              <span className="text-blue-400 font-medium">
                {deliveryPortName && selectedIncoDesc?.context === 'delivery'
                  ? `${incoterm} ${deliveryPortName}`
                  : incoterm}
              </span>
              {' — '}
              {INCOTERM_DESCRIPTIONS[incoterm]?.short.split('—')[1]?.trim()}
              {deliveryPortName && selectedIncoDesc?.context === 'delivery' && (
                <span className="text-gray-500"> · delivery to {deliveryPortName}</span>
              )}
            </p>
          )}
          {incoterm && !getIncotermHelperText() && selectedIncoDesc?.context === 'delivery' && !deliveryPortName && (
            <p className="mt-1 text-xs text-amber-500">Select a delivery port above to complete the incoterm location context.</p>
          )}
        </div>

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
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors"
          >
            {submitting ? 'Posting…' : 'Post Requirement'}
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
