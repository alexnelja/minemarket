'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { GeoPoint, CommodityType } from '@/lib/types';
import { COMMODITY_CONFIG, COMMODITY_PRICING } from '@/lib/types';
import type { DealSimulation, TradePoint, ForwardWaterfallStep } from '@/lib/forward-waterfall';
import type { OptimizationResult, RouteOption } from '@/lib/route-optimizer';
import { QUALITY_BADGES, DATA_SOURCES, type DataQuality, QUALITY_VARIANT } from '@/lib/data-sources';
import { QualityBadge } from '@/app/components/quality-badge';
import { calculateTimeline } from '@/lib/supply-chain-timeline';
import type { SupplyChainTimeline } from '@/lib/supply-chain-timeline';
import { TimelineVisual } from './timeline-visual';

// ── SA-focused defaults ─────────────────────────────────────────────────────

const PRIMARY_COMMODITIES: CommodityType[] = ['chrome', 'manganese'];
const ALL_COMMODITIES: CommodityType[] = ['chrome', 'manganese', 'iron_ore', 'coal', 'platinum', 'gold', 'copper', 'vanadium', 'titanium', 'aggregates'];

const SA_QUICK_ROUTES = [
  { label: 'Steelpoort → RB → Qingdao', commodity: 'chrome' as CommodityType, mine: 'Steelpoort Chrome', port: 'Richards Bay', dest: 'Qingdao, China', destCoords: { lat: 36.067, lng: 120.383 }, mineCoords: { lat: -24.69, lng: 30.19 }, portCoords: { lat: -28.801, lng: 32.038 } },
  { label: 'Hotazel → Saldanha → Qingdao', commodity: 'manganese' as CommodityType, mine: 'Hotazel Manganese', port: 'Saldanha Bay', dest: 'Qingdao, China', destCoords: { lat: 36.067, lng: 120.383 }, mineCoords: { lat: -27.24, lng: 22.95 }, portCoords: { lat: -33.004, lng: 17.938 } },
  { label: 'Steelpoort → RB → Mumbai', commodity: 'chrome' as CommodityType, mine: 'Steelpoort Chrome', port: 'Richards Bay', dest: 'Mumbai, India', destCoords: { lat: 18.940, lng: 72.840 }, mineCoords: { lat: -24.69, lng: 30.19 }, portCoords: { lat: -28.801, lng: 32.038 } },
  { label: 'Steelpoort → RB → Rotterdam', commodity: 'chrome' as CommodityType, mine: 'Steelpoort Chrome', port: 'Richards Bay', dest: 'Rotterdam, NL', destCoords: { lat: 51.953, lng: 4.133 }, mineCoords: { lat: -24.69, lng: 30.19 }, portCoords: { lat: -28.801, lng: 32.038 } },
  { label: 'Hotazel → PE → Qingdao', commodity: 'manganese' as CommodityType, mine: 'Hotazel Manganese', port: 'Port Elizabeth', dest: 'Qingdao, China', destCoords: { lat: 36.067, lng: 120.383 }, mineCoords: { lat: -27.24, lng: 22.95 }, portCoords: { lat: -33.768, lng: 25.629 } },
];

// Simplified corridor — 5 points (removed stockpile for clarity)
const VISUAL_CORRIDOR: { key: TradePoint; label: string; shortLabel: string }[] = [
  { key: 'mine_gate', label: 'Mine Gate (EXW)', shortLabel: 'Mine Gate' },
  { key: 'port_gate', label: 'Port Gate (FCA)', shortLabel: 'Port Gate' },
  { key: 'fob', label: 'FOB', shortLabel: 'FOB' },
  { key: 'cfr', label: 'CFR', shortLabel: 'CFR' },
  { key: 'cif', label: 'CIF', shortLabel: 'CIF' },
];

// Category display names for grouped breakdown
const CATEGORY_LABELS: Record<string, string> = {
  inland: 'Mine to Port',
  port: 'Port Costs',
  tax: 'Taxes & Fees',
  freight: 'Ocean Freight',
  finance: 'Hedging & Financing',
  cost: 'Other Costs',
};

const CATEGORY_ORDER = ['inland', 'port', 'tax', 'freight', 'finance', 'cost'];

const INPUT_CLS = 'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-white/20';

// ── Component Props ─────────────────────────────────────────────────────────

interface SimulatorClientProps {
  mines: { id: string; name: string; commodities?: CommodityType[]; location?: GeoPoint }[];
  loadingPorts: { id: string; name: string; location: GeoPoint; country: string }[];
  destinationPorts: { id: string; name: string; location: GeoPoint; country: string }[];
  indexPrices: Record<string, number>;
}

// ── Main Component ──────────────────────────────────────────────────────────

export function SimulatorClient({ indexPrices }: SimulatorClientProps) {
  // State: corridor selection
  const [selectionPhase, setSelectionPhase] = useState<'buy' | 'sell' | 'done'>('done');
  const [buyPoint, setBuyPoint] = useState<TradePoint>('mine_gate');
  const [sellPoint, setSellPoint] = useState<TradePoint>('cif');

  // State: trade params
  const [commodity, setCommodity] = useState<CommodityType>('chrome');
  const [buyPrice, setBuyPrice] = useState<string>('151');
  const [volume, setVolume] = useState<string>('15000');
  const [indexPriceOverride, setIndexPriceOverride] = useState<string>('');
  const [showAllCommodities, setShowAllCommodities] = useState(false);

  // State: route
  const [selectedRoute, setSelectedRoute] = useState<typeof SA_QUICK_ROUTES[0] | null>(SA_QUICK_ROUTES[0]);
  const [customRoute, setCustomRoute] = useState(false);

  // State: hedging & financing
  const [fxHedge, setFxHedge] = useState('spot');

  // State: results
  const [simulation, setSimulation] = useState<DealSimulation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // State: timeline
  const [timeline, setTimeline] = useState<SupplyChainTimeline | null>(null);

  // State: route optimization
  const [optimization, setOptimization] = useState<OptimizationResult | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [optimizeError, setOptimizeError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resolved index price
  const currentIndexPrice = indexPriceOverride ? parseFloat(indexPriceOverride) : (indexPrices[commodity] || 0);

  // Auto-set index price display when commodity changes
  useEffect(() => {
    setIndexPriceOverride('');
  }, [commodity]);

  // Handle corridor point click
  function handleCorridorClick(point: TradePoint) {
    const pointIndex = VISUAL_CORRIDOR.findIndex(p => p.key === point);

    if (selectionPhase === 'buy') {
      setBuyPoint(point);
      setSellPoint(null as unknown as TradePoint);
      setSelectionPhase('sell');
      setSimulation(null);
    } else if (selectionPhase === 'sell') {
      const buyIdx = VISUAL_CORRIDOR.findIndex(p => p.key === buyPoint);
      if (pointIndex > buyIdx) {
        setSellPoint(point);
        setSelectionPhase('done');
      }
    } else {
      // Already done — reset and start over
      setBuyPoint(point);
      setSellPoint(null as unknown as TradePoint);
      setSelectionPhase('sell');
      setSimulation(null);
    }
  }

  // Reset corridor
  function resetCorridor() {
    setBuyPoint(null as unknown as TradePoint);
    setSellPoint(null as unknown as TradePoint);
    setSelectionPhase('buy');
    setSimulation(null);
  }

  // Select quick route
  function selectQuickRoute(route: typeof SA_QUICK_ROUTES[0]) {
    setSelectedRoute(route);
    setCommodity(route.commodity);
    setCustomRoute(false);
    setBuyPoint('mine_gate');
    setSellPoint('cif');
    setSelectionPhase('done');
  }

  // Run simulation
  const runSimulation = useCallback(async () => {
    if (!buyPoint || !sellPoint || !buyPrice || parseFloat(buyPrice) <= 0) return;

    setLoading(true);
    setError(null);

    const route = selectedRoute;
    const params = new URLSearchParams({
      commodity,
      buy_point: buyPoint,
      sell_point: sellPoint,
      buy_price: buyPrice,
      volume: volume || '15000',
      loading_port: route?.port || 'Richards Bay',
      loading_lat: String(route?.portCoords?.lat || -28.801),
      loading_lng: String(route?.portCoords?.lng || 32.038),
      dest_lat: String(route?.destCoords?.lat || 36.067),
      dest_lng: String(route?.destCoords?.lng || 120.383),
      destination_name: route?.dest || 'Qingdao, China',
      transport_mode: 'rail',
      fx_hedge: fxHedge,
    });

    if (route?.mineCoords) {
      params.set('mine_lat', String(route.mineCoords.lat));
      params.set('mine_lng', String(route.mineCoords.lng));
      params.set('mine_name', route.mine || '');
    }

    if (currentIndexPrice > 0) {
      params.set('index_cif_price', String(currentIndexPrice));
    }

    try {
      const res = await fetch(`/api/deal-simulator?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json();
        setError(body.error || 'Simulation failed');
        return;
      }
      const data = await res.json();
      setSimulation(data);

      // Use server-side timeline (includes dynamic AIS/congestion data)
      // Fall back to client-side calculation if API doesn't return timeline
      if (data.timeline) {
        setTimeline(data.timeline);
      } else {
        const route = selectedRoute;
        const tl = calculateTimeline({
          mineCoords: route?.mineCoords,
          portCoords: route?.portCoords || { lat: -28.801, lng: 32.038 },
          destinationCoords: route?.destCoords,
          mineName: route?.mine,
          portName: route?.port || 'Richards Bay',
          destinationName: route?.dest,
          transportMode: 'rail',
          volumeTonnes: parseInt(volume) || 15000,
          buyPoint: buyPoint || 'mine_gate',
          sellPoint: sellPoint || 'cif',
          includePaymentTimeline: true,
        });
        setTimeline(tl);
      }
    } catch {
      setError('Failed to run simulation');
    } finally {
      setLoading(false);
    }
  }, [buyPoint, sellPoint, buyPrice, volume, commodity, selectedRoute, currentIndexPrice, fxHedge]);

  // Debounced auto-run when corridor is set
  useEffect(() => {
    if (selectionPhase !== 'done' || !buyPrice || parseFloat(buyPrice) <= 0) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(runSimulation, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [selectionPhase, runSimulation, buyPrice]);

  // Route optimization
  const runOptimization = useCallback(async () => {
    if (!buyPrice || parseFloat(buyPrice) <= 0) return;

    setOptimizing(true);
    setOptimizeError(null);

    const qp = new URLSearchParams({
      commodity,
      buy_point: buyPoint,
      sell_point: sellPoint,
      buy_price: buyPrice,
      volume: volume || '15000',
      fx_hedge: fxHedge,
    });

    const route = selectedRoute;
    if (route?.mineCoords) {
      qp.set('mine_lat', String(route.mineCoords.lat));
      qp.set('mine_lng', String(route.mineCoords.lng));
      qp.set('mine_name', route.mine || '');
    }

    if (currentIndexPrice > 0) {
      qp.set('index_price', String(currentIndexPrice));
    }

    try {
      const res = await fetch(`/api/optimize-routes?${qp.toString()}`);
      if (!res.ok) {
        const body = await res.json();
        setOptimizeError(body.error || 'Optimization failed');
        return;
      }
      const data = await res.json();
      setOptimization(data);
    } catch {
      setOptimizeError('Failed to run route optimization');
    } finally {
      setOptimizing(false);
    }
  }, [commodity, buyPoint, sellPoint, buyPrice, volume, selectedRoute, fxHedge, currentIndexPrice]);

  // Handle selecting an optimized route
  const handleSelectRoute = useCallback((route: RouteOption) => {
    // Find matching SA route or keep current
    const match = SA_QUICK_ROUTES.find(r => r.port === route.loadingPort);
    if (match) {
      selectQuickRoute(match);
    }
  }, []);

  // Corridor rendering helpers
  const buyIdx = buyPoint ? VISUAL_CORRIDOR.findIndex(p => p.key === buyPoint) : -1;
  const sellIdx = sellPoint ? VISUAL_CORRIDOR.findIndex(p => p.key === sellPoint) : -1;

  // Group simulation steps by category for the breakdown
  const groupedSteps = simulation ? groupStepsByCategory(simulation.steps) : [];

  const vol = parseInt(volume) || 15000;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Deal Simulator</h1>
        <p className="text-gray-400 text-sm mt-1">Click the pipeline to set your buy and sell points.</p>
      </div>

      {/* ════════════════════════════════════════════════════════
          CLICKABLE CORRIDOR PIPELINE
         ════════════════════════════════════════════════════════ */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <p className="text-xs text-gray-500 mb-6">
          {selectionPhase === 'buy' && (
            <span className="text-amber-400">Click where you BUY</span>
          )}
          {selectionPhase === 'sell' && (
            <span>
              Buying at <span className="text-emerald-400 font-semibold">{VISUAL_CORRIDOR.find(p => p.key === buyPoint)?.shortLabel}</span>
              {' — '}
              <span className="text-amber-400">now click where you SELL</span>
            </span>
          )}
          {selectionPhase === 'done' && (
            <span>
              Buying at <span className="text-emerald-400 font-semibold">{VISUAL_CORRIDOR.find(p => p.key === buyPoint)?.shortLabel}</span>
              {' → '}
              Selling at <span className="text-amber-400 font-semibold">{VISUAL_CORRIDOR.find(p => p.key === sellPoint)?.shortLabel}</span>
              <button onClick={resetCorridor} className="text-gray-400 hover:text-white ml-3 underline">Change</button>
            </span>
          )}
        </p>

        {/* Pipeline visualization */}
        <div className="flex items-center px-2">
          {VISUAL_CORRIDOR.map((point, i) => {
            const isInRange = buyIdx >= 0 && sellIdx >= 0 && i >= buyIdx && i <= sellIdx;
            const isBuy = buyPoint === point.key && selectionPhase !== 'buy';
            const isSell = sellPoint === point.key && selectionPhase === 'done';
            const isClickable =
              selectionPhase === 'buy' ||
              (selectionPhase === 'sell' && i > buyIdx) ||
              selectionPhase === 'done';

            return (
              <div key={point.key} className="flex items-center flex-1 first:flex-initial last:flex-initial">
                {/* Connecting line before */}
                {i > 0 && (
                  <div className={`flex-1 h-1 transition-colors ${
                    isInRange && i <= sellIdx ? 'bg-amber-500' : 'bg-gray-700'
                  }`} />
                )}

                {/* Point circle */}
                <button
                  onClick={() => isClickable && handleCorridorClick(point.key)}
                  disabled={!isClickable}
                  className={`relative w-10 h-10 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    isBuy ? 'bg-emerald-500 border-emerald-400 scale-110'
                    : isSell ? 'bg-amber-500 border-amber-400 scale-110'
                    : isInRange ? 'bg-amber-500/30 border-amber-500/50'
                    : isClickable ? 'bg-gray-800 border-gray-600 hover:border-white hover:scale-105 cursor-pointer'
                    : 'bg-gray-900 border-gray-700 opacity-40'
                  }`}
                >
                  {isBuy && <span className="text-[10px] font-bold text-black">BUY</span>}
                  {isSell && <span className="text-[10px] font-bold text-black">SELL</span>}
                  {!isBuy && !isSell && <span className="w-2 h-2 rounded-full bg-gray-500" />}

                  {/* Label below */}
                  <span className={`absolute -bottom-6 text-[10px] whitespace-nowrap ${
                    isBuy ? 'text-emerald-400 font-semibold'
                    : isSell ? 'text-amber-400 font-semibold'
                    : 'text-gray-500'
                  }`}>
                    {point.shortLabel}
                  </span>
                </button>

                {/* Connecting line after */}
                {i < VISUAL_CORRIDOR.length - 1 && (
                  <div className={`flex-1 h-1 transition-colors ${
                    isInRange && i < sellIdx ? 'bg-amber-500' : 'bg-gray-700'
                  }`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Spacer for labels */}
        <div className="h-4" />

        {/* Price labels under corridor when simulation is done */}
        {simulation && selectionPhase === 'done' && (
          <div className="flex items-center justify-between mt-2 px-2">
            <div className="text-center">
              <p className="text-emerald-400 font-semibold text-sm">${simulation.buyPrice.toFixed(2)}/t</p>
            </div>
            <div className="flex-1 text-center">
              <p className="text-gray-400 text-xs hidden sm:block">
                Corridor costs: <span className="text-white font-medium">${(simulation.sellPrice - simulation.buyPrice).toFixed(2)}/t</span>
              </p>
              {simulation.margin !== null && (
                <p className={`text-xs font-semibold mt-0.5 ${simulation.margin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  Margin: ${Math.abs(simulation.margin).toFixed(2)}/t ({simulation.marginPct !== null ? `${Math.abs(simulation.marginPct).toFixed(1)}%` : ''})
                </p>
              )}
            </div>
            <div className="text-center">
              <p className="text-amber-400 font-semibold text-sm">${simulation.sellPrice.toFixed(2)}/t</p>
            </div>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════
          QUICK ROUTES (SA focused)
         ════════════════════════════════════════════════════════ */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Quick Routes</h2>
        <div className="flex flex-wrap gap-2">
          {SA_QUICK_ROUTES.map((route, i) => (
            <button
              key={i}
              onClick={() => selectQuickRoute(route)}
              className={`text-xs px-3 py-2 rounded-lg border transition-colors ${
                selectedRoute === route && !customRoute
                  ? 'border-amber-500 text-amber-400 bg-amber-500/10'
                  : 'border-gray-700 text-gray-400 hover:border-gray-500'
              }`}
            >
              <span className="w-2 h-2 rounded-full inline-block mr-1.5" style={{ backgroundColor: COMMODITY_CONFIG[route.commodity]?.color }} />
              {route.label}
            </button>
          ))}
          <button
            onClick={() => { setCustomRoute(true); setSelectedRoute(null); }}
            className={`text-xs px-3 py-2 rounded-lg border transition-colors ${
              customRoute ? 'border-white text-white' : 'border-gray-700 text-gray-500 hover:text-gray-300'
            }`}
          >
            Custom route
          </button>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          TRADE DETAILS
         ════════════════════════════════════════════════════════ */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Trade Details</h2>

        {/* Commodity — chrome/manganese prominent */}
        <div>
          <label className="block text-sm text-gray-300 mb-2">Commodity</label>
          <div className="flex gap-2 flex-wrap">
            {PRIMARY_COMMODITIES.map(c => (
              <button key={c} onClick={() => setCommodity(c)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  commodity === c ? 'border-white text-white bg-gray-800' : 'border-gray-700 text-gray-400 hover:border-gray-500'
                }`}>
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COMMODITY_CONFIG[c]?.color }} />
                {COMMODITY_CONFIG[c]?.label}
                <span className="text-[10px] text-gray-500 ml-1">{COMMODITY_PRICING[c]?.label}</span>
              </button>
            ))}
            <button onClick={() => setShowAllCommodities(!showAllCommodities)}
              className="text-xs text-gray-500 hover:text-gray-300 px-3 py-2">
              {showAllCommodities ? 'Less' : 'More...'}
            </button>
          </div>
          {showAllCommodities && (
            <div className="flex gap-2 flex-wrap mt-2">
              {ALL_COMMODITIES.filter(c => !PRIMARY_COMMODITIES.includes(c)).map(c => (
                <button key={c} onClick={() => setCommodity(c)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-colors ${
                    commodity === c ? 'border-white text-white bg-gray-800' : 'border-gray-700 text-gray-400 hover:border-gray-500'
                  }`}>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COMMODITY_CONFIG[c]?.color }} />
                  {COMMODITY_CONFIG[c]?.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Price + Volume */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1">Buy price ($/t)</label>
            <input type="number" value={buyPrice} onChange={e => setBuyPrice(e.target.value)} placeholder="151"
              className={INPUT_CLS} />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Volume (tonnes)</label>
            <input type="number" value={volume} onChange={e => setVolume(e.target.value)} placeholder="15000"
              className={INPUT_CLS} />
          </div>
        </div>

        {/* Index price */}
        <div>
          <label className="block text-sm text-gray-300 mb-1">
            Market price at sell point ($/t)
            {indexPrices[commodity] ? (
              <span className="text-gray-500 ml-2">Latest: ${indexPrices[commodity]}</span>
            ) : (
              <span className="text-amber-400 ml-2">No index -- enter manually</span>
            )}
          </label>
          <input type="number" value={indexPriceOverride} onChange={e => setIndexPriceOverride(e.target.value)}
            placeholder={indexPrices[commodity] ? `${indexPrices[commodity]} (auto)` : 'Enter market price'}
            className={INPUT_CLS} />
        </div>

        {/* Loading indicator */}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <div className="w-4 h-4 border-2 border-gray-600 border-t-white rounded-full animate-spin" />
            Calculating...
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════
          HEDGING & FINANCING (collapsed)
         ════════════════════════════════════════════════════════ */}
      <details className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden group">
        <summary className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-800/30 list-none flex items-center justify-between">
          Hedging & Financing
          <ChevronIcon className="w-4 h-4 text-gray-500 transition-transform group-open:rotate-180" />
        </summary>
        <div className="px-6 pb-6 space-y-3">
          <div>
            <label className="text-xs text-gray-400">FX Hedge</label>
            <select value={fxHedge} onChange={e => setFxHedge(e.target.value)}
              className={INPUT_CLS + ' mt-1'}>
              <option value="spot">No hedge (spot)</option>
              <option value="forward_3m">3-month forward (~3.25% p.a.)</option>
              <option value="forward_6m">6-month forward (~3.25% p.a.)</option>
              <option value="collar_3m">3-month zero-cost collar (~1.5% p.a.)</option>
            </select>
          </div>
        </div>
      </details>

      {/* ── Error ─────────────────────────────────────────────── */}
      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          RESULTS
         ════════════════════════════════════════════════════════ */}
      {loading && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <div className="inline-block w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm text-gray-400">Calculating your margin...</p>
        </div>
      )}

      {simulation && (
        <>
          {/* ── Big Answer: Your Margin ─────────────────────────── */}
          <div className={`rounded-xl p-8 text-center ${
            simulation.margin !== null && simulation.margin >= 0
              ? 'bg-emerald-500/10 border border-emerald-500/20'
              : simulation.margin !== null
                ? 'bg-red-500/10 border border-red-500/20'
                : 'bg-gray-900 border border-gray-800'
          }`}>
            {simulation.margin !== null ? (
              <>
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Your Margin</p>
                <p className={`text-4xl font-bold tracking-tight ${
                  simulation.margin >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  ${Math.abs(simulation.margin).toFixed(2)}/t
                </p>
                <p className={`text-lg mt-1 ${
                  simulation.margin >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'
                }`}>
                  {simulation.marginPct !== null ? `${Math.abs(simulation.marginPct).toFixed(1)}%` : ''} {simulation.margin >= 0 ? 'profit' : 'loss'}
                </p>

                {simulation.totalProfit !== null && (
                  <p className="text-sm text-gray-400 mt-4">
                    Total profit on {vol.toLocaleString()}t:{' '}
                    <span className={`font-bold ${simulation.totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      ${Math.abs(simulation.totalProfit).toLocaleString()}
                    </span>
                  </p>
                )}

                <div className="grid grid-cols-3 gap-4 mt-6 text-sm">
                  <div>
                    <p className="text-gray-500">Your {simulation.sellPoint.toUpperCase()} cost</p>
                    <p className="text-white font-semibold">${simulation.sellPrice.toFixed(2)}/t</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Market price</p>
                    <p className="text-amber-400 font-semibold">
                      {simulation.indexSellPrice !== null ? `$${simulation.indexSellPrice.toFixed(2)}/t` : '---'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Breakeven buy</p>
                    <p className="text-white font-semibold">
                      {simulation.breakevenBuyPrice !== null ? `$${simulation.breakevenBuyPrice.toFixed(2)}/t` : '---'}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-gray-500 mt-4">
                  Estimated {simulation.estimatedDaysToDelivery} days mine to delivery
                </p>
              </>
            ) : (
              <>
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Your {simulation.sellPoint.toUpperCase()} Cost</p>
                <p className="text-4xl font-bold tracking-tight text-amber-400">
                  ${simulation.sellPrice.toFixed(2)}/t
                </p>
                <p className="text-sm text-gray-500 mt-4">
                  Set a market price above to see margin analysis
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Estimated {simulation.estimatedDaysToDelivery} days mine to delivery
                </p>
              </>
            )}
          </div>

          {/* ── Supply Chain Timeline ──────────────────────────── */}
          {timeline && <TimelineVisual timeline={timeline} />}

          {/* ── Cost Breakdown (collapsible, open by default) ──── */}
          <details open className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden group">
            <summary className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-800/30 list-none flex items-center justify-between">
              Cost Breakdown (${simulation.buyPrice.toFixed(2)} &rarr; ${simulation.sellPrice.toFixed(2)})
              <ChevronIcon className="w-4 h-4 text-gray-500 transition-transform group-open:rotate-180" />
            </summary>
            <div className="px-6 pb-6">
              <div className="space-y-5">
                {groupedSteps.map(group => (
                  <div key={group.category}>
                    {/* Category header with subtotal */}
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        {group.label}
                      </h3>
                      <span className="text-sm font-semibold text-white">
                        ${group.subtotal.toFixed(2)}/t
                      </span>
                    </div>
                    {/* Individual line items */}
                    <div className="space-y-1">
                      {group.steps.map((step, i) => (
                        <div key={i} className="flex items-center justify-between py-1 text-sm">
                          <span className="text-gray-300 flex items-center gap-2">
                            {step.label}
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="text-gray-300 tabular-nums">
                              ${step.amount.toFixed(2)}
                            </span>
                            {step.quality && (
                              <QualityBadge
                                label={QUALITY_BADGES[step.quality as DataQuality].label}
                                variant={QUALITY_VARIANT[step.quality as DataQuality]}
                              />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Divider between groups */}
                    <div className="border-t border-gray-800 mt-3" />
                  </div>
                ))}
              </div>
            </div>
          </details>

          {/* ── Route Optimization (collapsible) ───────────────── */}
          <details className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden group">
            <summary className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-800/30 list-none flex items-center justify-between">
              Find Best Route
              <ChevronIcon className="w-4 h-4 text-gray-500 transition-transform group-open:rotate-180" />
            </summary>
            <div className="px-6 pb-6 space-y-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={runOptimization}
                  disabled={optimizing || !buyPrice || parseFloat(buyPrice) <= 0}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                >
                  {optimizing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-gray-400 border-t-white rounded-full animate-spin" />
                      Evaluating routes...
                    </>
                  ) : (
                    'Optimize Routes'
                  )}
                </button>
                {currentIndexPrice <= 0 && (
                  <span className="text-xs text-gray-500">Set a market price to see margin rankings</span>
                )}
              </div>

              {optimizeError && (
                <div className="bg-red-900/30 border border-red-800 rounded-lg px-4 py-3 text-sm text-red-300">
                  {optimizeError}
                </div>
              )}

              {/* Route cards */}
              {optimization && optimization.routes.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 mb-2">
                    {optimization.routes.length} routes evaluated. Click to apply.
                  </p>
                  {optimization.routes.map((route) => {
                    const isBest = route.rank === optimization.bestRoute?.rank;
                    const marginPositive = route.margin >= 0;

                    return (
                      <button
                        key={`${route.loadingPort}-${route.destination}-${route.transportMode}`}
                        onClick={() => handleSelectRoute(route)}
                        className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                          isBest
                            ? 'bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10'
                            : 'bg-gray-800/50 border-gray-700 hover:bg-gray-800'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className={`text-xs font-bold w-6 ${isBest ? 'text-emerald-400' : 'text-gray-500'}`}>
                              #{route.rank}
                            </span>
                            <span className="text-sm text-white">
                              {route.loadingPort}
                              {route.destination !== 'N/A' && (
                                <span className="text-gray-400"> &rarr; {route.destination}</span>
                              )}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <span className={`font-semibold ${marginPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                              ${route.margin.toFixed(2)}/t
                            </span>
                            <span className="text-gray-500 text-xs">
                              {route.transitDays}d
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {optimization && optimization.routes.length === 0 && (
                <p className="text-sm text-gray-400">No viable routes found. Try adjusting parameters.</p>
              )}
            </div>
          </details>

          {/* ── Data Sources (collapsed) ───────────────────────── */}
          <DataSourcesPanel steps={simulation.steps} />
        </>
      )}
    </div>
  );
}

// ── Helper: Group steps by category ──────────────────────────────────────────

interface StepGroup {
  category: string;
  label: string;
  subtotal: number;
  steps: ForwardWaterfallStep[];
}

function groupStepsByCategory(steps: ForwardWaterfallStep[]): StepGroup[] {
  const groups = new Map<string, ForwardWaterfallStep[]>();

  for (const step of steps) {
    // Skip marker rows (like "= FOB PRICE", "= CIF COST", "= MARGIN")
    const isMarker = step.amount === 0 && step.label.startsWith('=');
    if (isMarker) continue;
    // Skip the initial buy price row (category: price)
    if (step.category === 'price') continue;

    const cat = step.category;
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(step);
  }

  // Sort by canonical order
  const result: StepGroup[] = [];
  for (const cat of CATEGORY_ORDER) {
    const catSteps = groups.get(cat);
    if (!catSteps || catSteps.length === 0) continue;

    const subtotal = catSteps.reduce((sum, s) => sum + s.amount, 0);
    result.push({
      category: cat,
      label: CATEGORY_LABELS[cat] || cat,
      subtotal,
      steps: catSteps,
    });
  }

  return result;
}

// ── Chevron Icon ─────────────────────────────────────────────────────────────

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

// ── Data Sources Panel ──────────────────────────────────────────────────────

function DataSourcesPanel({ steps }: { steps: DealSimulation['steps'] }) {
  // Collect unique sources from steps
  const sourceIds = new Set<string>();
  for (const step of steps) {
    if (step.sourceId) sourceIds.add(step.sourceId);
  }

  const uniqueSources = Array.from(sourceIds)
    .map(id => DATA_SOURCES[id])
    .filter(Boolean);

  if (uniqueSources.length === 0) return null;

  return (
    <details className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden group">
      <summary className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-800/30 list-none flex items-center justify-between">
        <div>
          <span>Data Sources & Accuracy</span>
          <span className="text-gray-500 font-normal ml-2">{uniqueSources.length} sources</span>
        </div>
        <ChevronIcon className="w-4 h-4 text-gray-500 transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-6 pb-5 space-y-2">
        {uniqueSources.map(source => (
          <div key={source.id} className="flex items-center gap-3">
            <QualityBadge
              label={QUALITY_BADGES[source.quality].label}
              variant={QUALITY_VARIANT[source.quality]}
            />
            <div className="flex-1 min-w-0">
              <span className="text-xs text-white">{source.name}</span>
              {source.lastUpdated && (
                <span className="text-[10px] text-gray-500 ml-2">Updated {source.lastUpdated}</span>
              )}
              <span className="text-[10px] text-gray-500 ml-2">{source.note}</span>
            </div>
            {source.upgradeAvailable && (
              <span className="text-[9px] text-amber-400 flex-shrink-0 hidden lg:block">
                Upgrade: {source.upgradeAvailable}
              </span>
            )}
          </div>
        ))}
      </div>
    </details>
  );
}
