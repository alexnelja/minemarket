'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { GeoPoint, CommodityType } from '@/lib/types';
import { COMMODITY_CONFIG, COMMODITY_PRICING } from '@/lib/types';
import type { TradePoint } from '@/lib/forward-waterfall';
import type { ReverseWaterfallResult, ReverseStep, VerificationCheckpoint } from '@/lib/reverse-waterfall';
import type { RouteOptimizationResult, TransitRouteOption } from '@/lib/route-optimizer';
import { LOADING_PORTS, DESTINATIONS } from '@/lib/route-optimizer';
import { getSubtypesForCommodity, type CommoditySubtype } from '@/lib/commodity-subtypes';
import { QUALITY_BADGES, type DataQuality, QUALITY_VARIANT } from '@/lib/data-sources';
import { QualityBadge } from '@/app/components/quality-badge';
import { calculateTimeline } from '@/lib/supply-chain-timeline';
import type { SupplyChainTimeline } from '@/lib/supply-chain-timeline';
import { TimelineVisual } from './timeline-visual';
import { RouteMap } from './route-map';

// ── Constants ────────────────────────────────────────────────────────────────

const PRIMARY_COMMODITIES: CommodityType[] = ['chrome', 'manganese'];
const ALL_COMMODITIES: CommodityType[] = ['chrome', 'manganese', 'iron_ore', 'coal', 'platinum', 'gold', 'copper', 'vanadium', 'titanium', 'aggregates'];

const VISUAL_CORRIDOR: { key: TradePoint; label: string; shortLabel: string }[] = [
  { key: 'mine_gate', label: 'Mine Gate (EXW)', shortLabel: 'Mine Gate' },
  { key: 'port_gate', label: 'Port Gate (FCA)', shortLabel: 'Port Gate' },
  { key: 'fob', label: 'FOB', shortLabel: 'FOB' },
  { key: 'cfr', label: 'CFR', shortLabel: 'CFR' },
  { key: 'cif', label: 'CIF', shortLabel: 'CIF' },
];

// Category labels removed — reverse waterfall steps rendered directly

const INPUT_CLS = 'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-white/20';

// ── Location data types ─────────────────────────────────────────────────────

interface LocationOption {
  id: string;
  name: string;
  coords: GeoPoint;
  country: string;
  type: 'mine' | 'sa_port' | 'intl_port';
  commodities?: CommodityType[];
}

// ── Component Props ─────────────────────────────────────────────────────────

interface SimulatorClientProps {
  mines: { id: string; name: string; commodities?: CommodityType[]; location?: GeoPoint }[];
  loadingPorts: { id: string; name: string; location: GeoPoint; country: string }[];
  destinationPorts: { id: string; name: string; location: GeoPoint; country: string }[];
  indexPrices: Record<string, number>;
}

// ── Main Component ──────────────────────────────────────────────────────────

export function SimulatorClient({ mines, loadingPorts, destinationPorts, indexPrices }: SimulatorClientProps) {
  // ── Step 1: What ──────────────────────────────────────────────────────────
  const [commodity, setCommodity] = useState<CommodityType>('chrome');
  const [subtype, setSubtype] = useState<string>('');
  const [grade, setGrade] = useState<string>('');
  const [sellPrice, setSellPrice] = useState<string>('315');
  const [volume, setVolume] = useState<string>('15000');
  const [indexPriceOverride, setIndexPriceOverride] = useState<string>('');
  const [showAllCommodities, setShowAllCommodities] = useState(false);

  // Legacy alias for backward compat in debounce deps
  const buyPrice = sellPrice;

  // ── Step 2: Where ─────────────────────────────────────────────────────────
  const [origin, setOrigin] = useState<LocationOption | null>(null);
  const [destination, setDestination] = useState<LocationOption | null>(null);

  // ── Step 3: Terms ─────────────────────────────────────────────────────────
  const [buyPoint, setBuyPoint] = useState<TradePoint>('mine_gate');
  const [sellPoint, setSellPoint] = useState<TradePoint>('cif');
  const [selectionPhase, setSelectionPhase] = useState<'buy' | 'sell' | 'done'>('done');
  const [fxHedge, setFxHedge] = useState('spot');

  // ── Cost overrides ────────────────────────────────────────────────────────
  const [costOverrides, setCostOverrides] = useState<Record<string, string>>({});
  const [showCostOverrides, setShowCostOverrides] = useState(false);

  // ── Results ───────────────────────────────────────────────────────────────
  // simulation state removed — replaced by reverseResult
  const [reverseResult, setReverseResult] = useState<(ReverseWaterfallResult & { checkpoints?: VerificationCheckpoint[] }) | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<SupplyChainTimeline | null>(null);
  const [optimization, setOptimization] = useState<RouteOptimizationResult | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [optimizeError, setOptimizeError] = useState<string | null>(null);

  // ── Save scenario ───────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [scenarioName, setScenarioName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [savedUrl, setSavedUrl] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Build location options from DB data ───────────────────────────────────

  const originOptions: LocationOption[] = mines
    .filter(m => m.location)
    .map(m => ({
      id: m.id,
      name: m.name,
      coords: m.location!,
      country: 'South Africa',
      type: 'mine' as const,
      commodities: m.commodities,
    }));

  // SA country codes/names for classification
  const SA_COUNTRIES = ['south africa', 'za', 'zaf', 'mozambique', 'mz', 'moz'];
  const isSaPort = (country: string) => SA_COUNTRIES.includes(country.toLowerCase());

  const destinationOptions: LocationOption[] = [
    // SA loading ports — for FOB sales
    ...loadingPorts
      .filter(p => isSaPort(p.country))
      .map(p => ({
        id: `sa-${p.id}`,
        name: p.name,
        coords: p.location,
        country: p.country,
        type: 'sa_port' as const,
      })),
    // International destination ports
    ...destinationPorts
      .filter(p => !isSaPort(p.country))
      .map(p => ({
        id: p.id,
        name: p.name,
        coords: p.location,
        country: p.country,
        type: 'intl_port' as const,
      })),
    // Hardcoded international destinations if not in DB
    ...DESTINATIONS
      .filter(d => !destinationPorts.some(p => p.name === d.name))
      .map(d => ({
        id: `dest-${d.name}`,
        name: d.name,
        coords: d.coords,
        country: d.region,
        type: 'intl_port' as const,
      })),
  ];

  // Deduplicate by name
  const uniqueDestinations = destinationOptions.filter(
    (d, i, arr) => arr.findIndex(x => x.name === d.name) === i
  );

  // ── Set default origin on load ────────────────────────────────────────────
  useEffect(() => {
    if (!origin && originOptions.length > 0) {
      const steelpoort = originOptions.find(m => m.name.toLowerCase().includes('steelpoort'));
      setOrigin(steelpoort || originOptions[0]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originOptions.length]);

  useEffect(() => {
    if (!destination && uniqueDestinations.length > 0) {
      // Prefer Qingdao, then any international port
      const qingdao = uniqueDestinations.find(d => d.name.toLowerCase().includes('qingdao') && d.type === 'intl_port');
      setDestination(qingdao || uniqueDestinations.find(d => d.type === 'intl_port') || uniqueDestinations[0]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uniqueDestinations.length]);

  // ── Derived state ─────────────────────────────────────────────────────────
  const subtypes = getSubtypesForCommodity(commodity);
  const selectedSubtype = subtypes.find(s => s.key === subtype) || null;
  const isDmtu = selectedSubtype?.pricingUnit === 'per_dmtu' || COMMODITY_PRICING[commodity]?.unit === 'per_dmtu';
  const gradeNum = parseFloat(grade) || 0;

  // Reference grades for price adjustment
  const REFERENCE_GRADES: Record<string, number> = { chrome: 42, manganese: 37 };
  const refGrade = REFERENCE_GRADES[commodity];
  const gradeLabel = commodity === 'chrome' ? 'Cr₂O₃' : commodity === 'manganese' ? 'Mn' : '';

  // Convert dmtu to $/t if needed
  const rawBuyPrice = parseFloat(buyPrice) || 0;
  const effectiveBuyPrice = isDmtu && gradeNum > 0
    ? rawBuyPrice * gradeNum / 100  // $/dmtu × grade% = $/t
    : rawBuyPrice;

  const currentIndexPrice = indexPriceOverride ? parseFloat(indexPriceOverride) : (indexPrices[commodity] || 0);
  const isFobSell = sellPoint && !['cfr', 'cif'].includes(sellPoint);

  // Reset subtype/grade when commodity changes
  useEffect(() => {
    setSubtype('');
    setGrade('');
    setIndexPriceOverride('');
    // Set default grade for chrome/manganese
    if (REFERENCE_GRADES[commodity]) {
      setGrade(String(REFERENCE_GRADES[commodity]));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commodity]);

  // Auto-set grade from subtype
  useEffect(() => {
    if (selectedSubtype?.gradeRange) {
      // Extract first number from range like "42-46% Cr₂O₃"
      const match = selectedSubtype.gradeRange.match(/(\d+)/);
      if (match) setGrade(match[1]);
    }
  }, [selectedSubtype]);

  // Auto-adjust sell point when destination is SA port
  useEffect(() => {
    if (destination?.type === 'sa_port' && ['cfr', 'cif'].includes(sellPoint)) {
      setSellPoint('fob');
      setSelectionPhase('done');
    }
  }, [destination, sellPoint]);

  // (index price reset handled in commodity change effect above)

  // ── Corridor handlers ─────────────────────────────────────────────────────
  const buyIdx = buyPoint ? VISUAL_CORRIDOR.findIndex(p => p.key === buyPoint) : -1;
  const sellIdx = sellPoint ? VISUAL_CORRIDOR.findIndex(p => p.key === sellPoint) : -1;

  function handleCorridorClick(point: TradePoint) {
    const pointIndex = VISUAL_CORRIDOR.findIndex(p => p.key === point);
    // Block CFR/CIF if destination is SA port
    if (destination?.type === 'sa_port' && ['cfr', 'cif'].includes(point)) return;

    if (selectionPhase === 'buy') {
      setBuyPoint(point);
      setSellPoint(null as unknown as TradePoint);
      setSelectionPhase('sell');
      setReverseResult(null);
    } else if (selectionPhase === 'sell') {
      const bIdx = VISUAL_CORRIDOR.findIndex(p => p.key === buyPoint);
      if (pointIndex > bIdx) {
        setSellPoint(point);
        setSelectionPhase('done');
      }
    } else {
      setBuyPoint(point);
      setSellPoint(null as unknown as TradePoint);
      setSelectionPhase('sell');
      setReverseResult(null);
    }
  }

  function resetCorridor() {
    setBuyPoint(null as unknown as TradePoint);
    setSellPoint(null as unknown as TradePoint);
    setSelectionPhase('buy');
    setReverseResult(null);
  }

  // ── Run reverse waterfall + route optimization in parallel ────────────────
  const runSimulation = useCallback(async () => {
    const sp = parseFloat(sellPrice);
    if (!sellPoint || !sp || sp <= 0 || !origin) return;

    setLoading(true);
    setError(null);
    setReverseResult(null);

    // Find nearest SA loading port
    const nearestPort = LOADING_PORTS.reduce((best, p) => {
      const dist = Math.abs(p.coords.lat - origin.coords.lat) + Math.abs(p.coords.lng - origin.coords.lng);
      const bestDist = Math.abs(best.coords.lat - origin.coords.lat) + Math.abs(best.coords.lng - origin.coords.lng);
      return dist < bestDist ? p : best;
    });

    // Build reverse waterfall params
    const rwParams = new URLSearchParams({
      commodity,
      sell_price: sellPrice,
      sell_point: sellPoint,
      buy_point: buyPoint || 'mine_gate',
      volume: volume || '15000',
      loading_port: isFobSell && destination ? destination.name : nearestPort.name,
      loading_lat: String(isFobSell && destination ? destination.coords.lat : nearestPort.coords.lat),
      loading_lng: String(isFobSell && destination ? destination.coords.lng : nearestPort.coords.lng),
      transport_mode: 'rail',
      fx_hedge: fxHedge,
      mine_lat: String(origin.coords.lat),
      mine_lng: String(origin.coords.lng),
      mine_name: origin.name,
    });

    if (!isFobSell && destination) {
      rwParams.set('dest_lat', String(destination.coords.lat));
      rwParams.set('dest_lng', String(destination.coords.lng));
      rwParams.set('dest_name', destination.name);
    }
    if (gradeNum > 0) rwParams.set('grade', String(gradeNum));
    for (const [key, val] of Object.entries(costOverrides)) {
      if (val && parseFloat(val) >= 0) rwParams.set(`override_${key}`, val);
    }

    // Build optimize-routes params
    const optParams = new URLSearchParams({
      commodity,
      buy_point: buyPoint || 'mine_gate',
      sell_point: sellPoint,
      buy_price: '1', // Dummy — we use the reverse result for breakeven
      volume: volume || '15000',
      origin_lat: String(origin.coords.lat),
      origin_lng: String(origin.coords.lng),
      origin_name: origin.name,
    });
    if (!isFobSell && destination) {
      optParams.set('dest_lat', String(destination.coords.lat));
      optParams.set('dest_lng', String(destination.coords.lng));
      optParams.set('dest_name', destination.name);
    }
    if (currentIndexPrice > 0) optParams.set('index_price', String(currentIndexPrice));
    if (gradeNum > 0) optParams.set('grade', String(gradeNum));

    try {
      // Run both in parallel
      const [rwRes, optRes] = await Promise.all([
        fetch(`/api/reverse-waterfall?${rwParams.toString()}`),
        fetch(`/api/optimize-routes?${optParams.toString()}`),
      ]);

      if (rwRes.ok) {
        const rwData = await rwRes.json();
        setReverseResult(rwData);
      } else {
        const body = await rwRes.json();
        setError(body.error || 'Calculation failed');
      }

      if (optRes.ok) {
        const optData = await optRes.json();
        setOptimization(optData);
      }

      // Also calculate timeline
      const tl = calculateTimeline({
        mineCoords: origin.coords,
        portCoords: isFobSell && destination ? destination.coords : nearestPort.coords,
        destinationCoords: !isFobSell && destination ? destination.coords : undefined,
        mineName: origin.name,
        portName: isFobSell && destination ? destination.name : nearestPort.name,
        destinationName: destination?.name,
        transportMode: 'rail',
        volumeTonnes: parseInt(volume) || 15000,
        buyPoint: buyPoint || 'mine_gate',
        sellPoint: sellPoint || 'cif',
        includePaymentTimeline: true,
      });
      setTimeline(tl);
    } catch {
      setError('Failed to run calculation');
    } finally {
      setLoading(false);
    }
  }, [sellPoint, sellPrice, buyPoint, volume, commodity, origin, destination, currentIndexPrice, fxHedge, isFobSell, costOverrides, gradeNum]);

  // Debounced auto-run
  useEffect(() => {
    if (selectionPhase !== 'done' || !sellPrice || parseFloat(sellPrice) <= 0 || !origin) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(runSimulation, 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [selectionPhase, runSimulation, sellPrice, origin, destination]);

  // ── Save scenario ──────────────────────────────────────────────────────────
  const saveScenario = useCallback(async () => {
    if (!scenarioName.trim() || !reverseResult) return;
    setSaving(true);
    try {
      const res = await fetch('/api/scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: scenarioName.trim(),
          commodity,
          commodity_subtype: subtype || null,
          grade: gradeNum || null,
          sell_price: parseFloat(sellPrice),
          sell_point: sellPoint,
          buy_point: buyPoint,
          volume_tonnes: parseInt(volume) || 15000,
          mine_name: origin?.name || null,
          mine_lat: origin?.coords.lat || null,
          mine_lng: origin?.coords.lng || null,
          loading_port: destination?.type === 'sa_port' ? destination.name : null,
          destination_name: destination?.name || null,
          destination_lat: destination?.coords.lat || null,
          destination_lng: destination?.coords.lng || null,
          breakeven_buy_price: reverseResult.breakevenBuyPrice,
          total_costs: reverseResult.totalCosts,
          cost_breakdown: reverseResult.steps,
          verification_checkpoints: reverseResult.checkpoints,
          all_routes: optimization?.routes || null,
          transport_mode: 'rail',
          fx_hedge: fxHedge,
          cost_overrides: Object.keys(costOverrides).length > 0 ? costOverrides : null,
          index_price_used: currentIndexPrice || null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSavedUrl(`/scenarios`);
        setShowSaveDialog(false);
        setScenarioName('');
      }
    } catch { /* ignore */ }
    setSaving(false);
  }, [scenarioName, reverseResult, commodity, subtype, gradeNum, sellPrice, sellPoint, buyPoint, volume, origin, destination, optimization, fxHedge, costOverrides, currentIndexPrice]);

  // Route optimization now runs in parallel with reverse waterfall (inside runSimulation)

  const vol = parseInt(volume) || 15000;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Deal Simulator</h1>
        <p className="text-gray-400 text-sm mt-1">Enter your sell price. See what you can afford to pay at the mine.</p>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          STEP 1: WHAT — Commodity, Price, Volume
         ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <StepHeader step={1} title="What are you trading?" />

        {/* Commodity selection */}
        <div>
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

        {/* Subtype + Grade (for chrome/manganese) */}
        {subtypes.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Product type</label>
              <select
                value={subtype}
                onChange={e => setSubtype(e.target.value)}
                className={INPUT_CLS}
              >
                <option value="">All grades</option>
                {subtypes.slice(0, 6).map(s => (
                  <option key={s.key} value={s.key}>{s.label} ({s.gradeRange})</option>
                ))}
              </select>
            </div>
            {gradeLabel && (
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  {gradeLabel} grade (%)
                  {refGrade && <span className="text-gray-600 ml-1">Benchmark: {refGrade}%</span>}
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={grade}
                  onChange={e => setGrade(e.target.value)}
                  placeholder={refGrade ? String(refGrade) : ''}
                  className={INPUT_CLS}
                />
              </div>
            )}
          </div>
        )}

        {/* Price + Volume + Index */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              Sell price {isDmtu ? '($/dmtu)' : '($/t)'}
            </label>
            <input type="number" value={sellPrice} onChange={e => setSellPrice(e.target.value)}
              placeholder={isDmtu ? '8.50' : '315'}
              className={INPUT_CLS} />
            {isDmtu && gradeNum > 0 && rawBuyPrice > 0 && (
              <p className="text-[10px] text-gray-500 mt-1">
                = ${effectiveBuyPrice.toFixed(2)}/t at {gradeNum}% {gradeLabel}
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Volume (tonnes)</label>
            <input type="number" value={volume} onChange={e => setVolume(e.target.value)} placeholder="15000"
              className={INPUT_CLS} />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              Market price {isDmtu ? '($/dmtu)' : '($/t)'}
              {indexPrices[commodity] ? (
                <span className="text-gray-600 ml-1">${indexPrices[commodity]}</span>
              ) : null}
            </label>
            <input type="number" value={indexPriceOverride} onChange={e => setIndexPriceOverride(e.target.value)}
              placeholder={indexPrices[commodity] ? `${indexPrices[commodity]} (auto)` : 'Enter price'}
              className={INPUT_CLS} />
          </div>
        </div>

        {/* Grade adjustment info */}
        {gradeNum > 0 && refGrade && gradeNum !== refGrade && (
          <p className="text-[10px] text-gray-500">
            Grade adjustment: {gradeNum}% vs {refGrade}% benchmark = {((gradeNum / refGrade) * 100).toFixed(0)}% of index value
          </p>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          STEP 2: WHERE — Origin + Destination (map search)
         ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <StepHeader step={2} title="Where from and where to?" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Origin (mine) */}
          <LocationSearch
            label="Origin (mine / stockpile)"
            icon="⛏"
            options={originOptions}
            selected={origin}
            onSelect={setOrigin}
            filterByCommidity={commodity}
          />

          {/* Destination */}
          <LocationSearch
            label="Destination (port)"
            icon="⚓"
            options={uniqueDestinations}
            selected={destination}
            onSelect={(d) => {
              setDestination(d);
              // Auto-adjust sell point if picking SA port
              if (d?.type === 'sa_port' && ['cfr', 'cif'].includes(sellPoint)) {
                setSellPoint('fob');
                setSelectionPhase('done');
              } else if (d?.type === 'intl_port' && isFobSell) {
                setSellPoint('cif');
                setSelectionPhase('done');
              }
            }}
          />
        </div>

        {/* Mini route summary */}
        {origin && destination && (
          <div className="flex items-center gap-2 text-xs text-gray-500 pt-1">
            <span className="text-emerald-400">{origin.name}</span>
            <span>→</span>
            <span className="text-amber-400">{destination.name}</span>
            {destination.type === 'sa_port' && (
              <span className="ml-2 text-[10px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded">FOB — selling at SA port</span>
            )}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          STEP 3: TERMS — Corridor pipeline + hedging
         ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <StepHeader step={3} title="Where do you buy and sell?" />

        <p className="text-xs text-gray-500">
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
            const isDisabled = destination?.type === 'sa_port' && ['cfr', 'cif'].includes(point.key);
            const isClickable = !isDisabled && (
              selectionPhase === 'buy' ||
              (selectionPhase === 'sell' && i > buyIdx) ||
              selectionPhase === 'done'
            );

            return (
              <div key={point.key} className="flex items-center flex-1 first:flex-initial last:flex-initial">
                {i > 0 && (
                  <div className={`flex-1 h-1 transition-colors ${
                    isInRange && i <= sellIdx ? 'bg-amber-500' : 'bg-gray-700'
                  }`} />
                )}
                <button
                  onClick={() => isClickable && handleCorridorClick(point.key)}
                  disabled={!isClickable}
                  title={isDisabled ? 'Select international destination for CIF/CFR' : point.label}
                  className={`relative w-10 h-10 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    isBuy ? 'bg-emerald-500 border-emerald-400 scale-110'
                    : isSell ? 'bg-amber-500 border-amber-400 scale-110'
                    : isInRange ? 'bg-amber-500/30 border-amber-500/50'
                    : isDisabled ? 'bg-gray-900 border-gray-800 opacity-30 cursor-not-allowed'
                    : isClickable ? 'bg-gray-800 border-gray-600 hover:border-white hover:scale-105 cursor-pointer'
                    : 'bg-gray-900 border-gray-700 opacity-40'
                  }`}
                >
                  {isBuy && <span className="text-[10px] font-bold text-black">BUY</span>}
                  {isSell && <span className="text-[10px] font-bold text-black">SELL</span>}
                  {!isBuy && !isSell && <span className="w-2 h-2 rounded-full bg-gray-500" />}
                  <span className={`absolute -bottom-6 text-[10px] whitespace-nowrap ${
                    isBuy ? 'text-emerald-400 font-semibold'
                    : isSell ? 'text-amber-400 font-semibold'
                    : isDisabled ? 'text-gray-700'
                    : 'text-gray-500'
                  }`}>
                    {point.shortLabel}
                  </span>
                </button>
                {i < VISUAL_CORRIDOR.length - 1 && (
                  <div className={`flex-1 h-1 transition-colors ${
                    isInRange && i < sellIdx ? 'bg-amber-500' : 'bg-gray-700'
                  }`} />
                )}
              </div>
            );
          })}
        </div>
        <div className="h-4" />

        {/* Price labels under corridor */}
        {reverseResult && selectionPhase === 'done' && (
          <div className="flex items-center justify-between px-2">
            <div className="text-center">
              <p className="text-emerald-400 font-semibold text-sm">${reverseResult.breakevenBuyPrice.toFixed(2)}/t</p>
            </div>
            <div className="flex-1 text-center">
              <p className="text-gray-400 text-xs hidden sm:block">
                Costs: <span className="text-white font-medium">${reverseResult.totalCosts.toFixed(2)}/t</span>
              </p>
            </div>
            <div className="text-center">
              <p className="text-amber-400 font-semibold text-sm">${reverseResult.sellPrice.toFixed(2)}/t</p>
            </div>
          </div>
        )}

        {/* Hedging */}
        <div className="border-t border-gray-800 pt-3 mt-2">
          <div className="flex items-center gap-4">
            <label className="text-xs text-gray-400 whitespace-nowrap">FX Hedge</label>
            <select value={fxHedge} onChange={e => setFxHedge(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-white/20">
              <option value="spot">No hedge (spot)</option>
              <option value="forward_3m">3m forward (~3.25% p.a.)</option>
              <option value="forward_6m">6m forward (~3.25% p.a.)</option>
              <option value="collar_3m">3m zero-cost collar (~1.5% p.a.)</option>
            </select>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          COST OVERRIDES (optional)
         ═══════════════════════════════════════════════════════════════════ */}
      <button
        onClick={() => setShowCostOverrides(!showCostOverrides)}
        className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1.5 px-1"
      >
        <ChevronIcon className={`w-3 h-3 transition-transform ${showCostOverrides ? 'rotate-180' : ''}`} />
        {showCostOverrides ? 'Hide' : 'Override'} individual costs
      </button>

      {showCostOverrides && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-3">
          <p className="text-xs text-gray-500 mb-2">Leave blank to use calculated values. Enter $/t to override.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {COST_OVERRIDE_FIELDS.map(field => (
              <div key={field.key}>
                <label className="block text-[10px] text-gray-500 mb-0.5">{field.label}</label>
                <input
                  type="number"
                  step="0.01"
                  value={costOverrides[field.key] || ''}
                  onChange={e => setCostOverrides(prev => ({ ...prev, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-white/20"
                />
              </div>
            ))}
          </div>
          <button
            onClick={() => setCostOverrides({})}
            className="text-[10px] text-gray-500 hover:text-gray-300 underline"
          >
            Reset all overrides
          </button>
        </div>
      )}

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* ── Loading ────────────────────────────────────────────────────────── */}
      {loading && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <div className="inline-block w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm text-gray-400">Calculating breakeven...</p>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          RESULTS — Reverse Waterfall
         ═══════════════════════════════════════════════════════════════════ */}
      {reverseResult && (
        <>
          {/* ── Breakeven hero ─────────────────────────────────────────── */}
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-8 text-center">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Breakeven Buy Price</p>
            <p className="text-4xl font-bold tracking-tight text-emerald-400">
              ${reverseResult.breakevenBuyPrice.toFixed(2)}/t
            </p>
            <p className="text-sm text-gray-400 mt-2">
              Maximum you can pay at {buyPoint === 'mine_gate' ? 'the mine' : buyPoint.toUpperCase()} and still break even
            </p>

            <div className="grid grid-cols-3 gap-4 mt-6 text-sm">
              <div>
                <p className="text-gray-500">Your sell price</p>
                <p className="text-amber-400 font-semibold">${reverseResult.sellPrice.toFixed(2)}/t {sellPoint.toUpperCase()}</p>
              </div>
              <div>
                <p className="text-gray-500">Total costs</p>
                <p className="text-white font-semibold">${reverseResult.totalCosts.toFixed(2)}/t</p>
              </div>
              <div>
                <p className="text-gray-500">Market index</p>
                <p className="text-gray-300 font-semibold">
                  {currentIndexPrice > 0 ? `$${currentIndexPrice}/t` : '---'}
                </p>
              </div>
            </div>

            {timeline && (
              <p className="text-xs text-gray-500 mt-4">
                Estimated {timeline.totalDays} days mine to delivery
              </p>
            )}
          </div>

          {/* ── Route Map ─────────────────────────────────────────────── */}
          {optimization && optimization.routes.length > 0 && (
            <RouteMap
              origin={origin ? { name: origin.name, coords: origin.coords } : null}
              destination={destination ? { name: destination.name, coords: destination.coords } : null}
              routes={optimization.routes}
              bestRouteRank={optimization.bestByMargin?.rank ?? null}
              isFob={!!isFobSell}
            />
          )}

          {/* ── Route Comparison (auto-loaded) ─────────────────────────── */}
          {optimization && optimization.routes.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {isFobSell ? 'Best Port Options' : 'Route Comparison'}
                </h2>
                <span className="text-[10px] text-gray-600">{optimization.routes.length} options evaluated</span>
              </div>
              {optimization.routes.slice(0, 5).map((route) => {
                const isBest = route.rank === optimization.bestByMargin?.rank;
                const isFastest = route.rank === optimization.bestBySpeed?.rank;
                // For reverse: breakeven = sell price - route total cost
                const routeBreakeven = parseFloat(sellPrice) - route.totalCostPerTonne + (parseFloat(sellPrice) > 0 ? route.margin : 0);

                return (
                  <div
                    key={`${route.transitPort}-${route.transportMode}`}
                    className={`px-4 py-3.5 rounded-lg border transition-colors ${
                      isBest
                        ? 'bg-emerald-500/5 border-emerald-500/20'
                        : 'bg-gray-800/50 border-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-bold w-6 ${isBest ? 'text-emerald-400' : 'text-gray-500'}`}>
                          #{route.rank}
                        </span>
                        <span className="text-sm text-white">
                          {isFobSell ? route.transitPort : <>via {route.transitPort}</>}
                          <span className="text-gray-500 ml-1">({route.transportMode})</span>
                        </span>
                        {isBest && <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">BEST</span>}
                        {isFastest && !isBest && <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">FASTEST</span>}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-white">
                          ${route.totalCostPerTonne.toFixed(2)}/t costs
                        </p>
                        <p className="text-xs text-gray-500">{route.totalDays}d transit</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-1.5 ml-9">
                      <span className="text-xs text-gray-500">
                        {route.inlandDistKm.toLocaleString()}km {route.transportMode}
                        {route.oceanDistNm > 0 && <> + {route.oceanDistNm.toLocaleString()}nm sea</>}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Verification Checkpoints ───────────────────────────────── */}
          {reverseResult.checkpoints && reverseResult.checkpoints.length > 0 && (
            <details className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden group">
              <summary className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-800/30 list-none flex items-center justify-between">
                Verification Checkpoints ({reverseResult.checkpoints.length})
                <ChevronIcon className="w-4 h-4 text-gray-500 transition-transform group-open:rotate-180" />
              </summary>
              <div className="px-6 pb-6 space-y-3">
                {reverseResult.checkpoints.map((cp: VerificationCheckpoint, i: number) => (
                  <div key={i} className="flex items-start gap-3 py-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                      cp.verifiedBy === 'independent' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      : cp.verifiedBy === 'government' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : cp.verifiedBy === 'seller' ? 'bg-gray-800 text-gray-400 border border-gray-700'
                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}>
                      {cp.point === 'mine_gate' ? '⛏' : cp.point === 'fob' ? '🚢' : cp.point === 'cif' ? '📦' : '🏭'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-white font-medium">{cp.label}</p>
                        <span className="text-[10px] text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">{cp.point.toUpperCase()}</span>
                        {cp.required && <span className="text-[10px] text-amber-400">Required</span>}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{cp.description}</p>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-600">
                        {cp.estimatedCost > 0 && <span>${cp.estimatedCost.toFixed(2)}/t</span>}
                        {cp.estimatedDays > 0 && <span>{cp.estimatedDays}d</span>}
                        <span>Verified by: {cp.verifiedBy}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* ── Cost Breakdown (reverse) ───────────────────────────────── */}
          <details open className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden group">
            <summary className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-800/30 list-none flex items-center justify-between">
              Cost Breakdown (${reverseResult.sellPrice.toFixed(2)} &rarr; ${reverseResult.breakevenBuyPrice.toFixed(2)})
              <ChevronIcon className="w-4 h-4 text-gray-500 transition-transform group-open:rotate-180" />
            </summary>
            <div className="px-6 pb-6">
              <div className="space-y-1">
                <div className="flex items-center justify-between py-2 border-b border-gray-800">
                  <span className="text-sm text-amber-400 font-semibold">Sell Price ({sellPoint.toUpperCase()})</span>
                  <span className="text-sm text-amber-400 font-semibold tabular-nums">${reverseResult.sellPrice.toFixed(2)}</span>
                </div>
                {reverseResult.steps.map((step: ReverseStep, i: number) => (
                  <div key={i} className="flex items-center justify-between py-1.5 text-sm">
                    <span className="text-gray-300">{step.label}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-red-400 tabular-nums">-${step.amount.toFixed(2)}</span>
                      {step.quality && (
                        <QualityBadge
                          label={QUALITY_BADGES[step.quality as DataQuality].label}
                          variant={QUALITY_VARIANT[step.quality as DataQuality]}
                        />
                      )}
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between py-2 border-t border-gray-800 mt-2">
                  <span className="text-sm text-emerald-400 font-semibold">Breakeven Buy Price</span>
                  <span className="text-sm text-emerald-400 font-semibold tabular-nums">${reverseResult.breakevenBuyPrice.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </details>

          {/* ── Supply Chain Timeline ─────────────────────────────────────── */}
          {timeline && <TimelineVisual timeline={timeline} />}

          {/* ── Save Scenario ─────────────────────────────────────────────── */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            {!showSaveDialog && !savedUrl && (
              <button
                onClick={() => setShowSaveDialog(true)}
                className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors border border-gray-700"
              >
                Save Scenario
              </button>
            )}
            {showSaveDialog && (
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={scenarioName}
                  onChange={e => setScenarioName(e.target.value)}
                  placeholder={`${COMMODITY_CONFIG[commodity]?.label} ${sellPoint.toUpperCase()} ${origin?.name || ''}`}
                  className={INPUT_CLS + ' flex-1'}
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && saveScenario()}
                />
                <button
                  onClick={saveScenario}
                  disabled={saving || !scenarioName.trim()}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button onClick={() => setShowSaveDialog(false)} className="text-gray-500 hover:text-white text-sm px-2">
                  Cancel
                </button>
              </div>
            )}
            {savedUrl && (
              <div className="text-center">
                <p className="text-emerald-400 text-sm font-medium">Scenario saved</p>
                <a href={savedUrl} className="text-xs text-gray-400 hover:text-white underline mt-1 inline-block">
                  View in My Scenarios
                </a>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Cost override field definitions ─────────────────────────────────────────

const COST_OVERRIDE_FIELDS = [
  { key: 'inland_transport', label: 'Inland transport ($/t)', placeholder: 'auto' },
  { key: 'port_handling', label: 'Port handling ($/t)', placeholder: 'auto' },
  { key: 'stevedoring', label: 'Stevedoring ($/t)', placeholder: 'auto' },
  { key: 'wharfage', label: 'Wharfage ($/t)', placeholder: 'auto' },
  { key: 'ocean_freight', label: 'Ocean freight ($/t)', placeholder: 'auto' },
  { key: 'insurance', label: 'Insurance ($/t)', placeholder: 'auto' },
  { key: 'royalty', label: 'MPRRA royalty ($/t)', placeholder: 'auto' },
  { key: 'customs_broker', label: 'Customs broker ($/t)', placeholder: 'auto' },
  { key: 'discharge', label: 'Discharge fees ($/t)', placeholder: 'auto' },
];

// ── Step header ─────────────────────────────────────────────────────────────

function StepHeader({ step, title }: { step: number; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-1">
      <span className="w-6 h-6 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-[10px] font-bold text-gray-400">
        {step}
      </span>
      <h2 className="text-sm font-medium text-white">{title}</h2>
    </div>
  );
}

// ── Location Search ─────────────────────────────────────────────────────────

function LocationSearch({
  label,
  icon,
  options,
  selected,
  onSelect,
  filterByCommidity,
}: {
  label: string;
  icon: string;
  options: LocationOption[];
  selected: LocationOption | null;
  onSelect: (option: LocationOption | null) => void;
  filterByCommidity?: CommodityType;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Filter options
  let filtered = options;
  if (query.length > 0) {
    const q = query.toLowerCase();
    filtered = options.filter(o =>
      o.name.toLowerCase().includes(q) ||
      o.country.toLowerCase().includes(q)
    );
  }

  // For mines, prioritize those matching the commodity
  if (filterByCommidity) {
    filtered = [
      ...filtered.filter(o => o.commodities?.includes(filterByCommidity)),
      ...filtered.filter(o => !o.commodities?.includes(filterByCommidity)),
    ];
  }

  // Group by type
  const grouped = {
    mine: filtered.filter(o => o.type === 'mine'),
    sa_port: filtered.filter(o => o.type === 'sa_port'),
    intl_port: filtered.filter(o => o.type === 'intl_port'),
  };

  const typeLabels: Record<string, string> = {
    mine: 'Mines',
    sa_port: 'SA Ports (FOB)',
    intl_port: 'International Ports',
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <div
        className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 cursor-pointer hover:border-gray-500 transition-colors"
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
      >
        <span className="text-sm">{icon}</span>
        {selected ? (
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white truncate">{selected.name}</p>
            <p className="text-[10px] text-gray-500">{selected.country}</p>
          </div>
        ) : (
          <span className="text-sm text-gray-500">Search...</span>
        )}
        <ChevronIcon className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
      </div>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-xl max-h-72 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-gray-800">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Type to search..."
              className="w-full bg-gray-800 border border-gray-700 rounded px-2.5 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-white/20"
            />
          </div>
          <div className="overflow-y-auto flex-1">
            {Object.entries(grouped).map(([type, items]) => {
              if (items.length === 0) return null;
              return (
                <div key={type}>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider px-3 py-1.5 bg-gray-900/50 sticky top-0">
                    {typeLabels[type]} ({items.length})
                  </p>
                  {items.slice(0, 20).map(option => (
                    <button
                      key={option.id}
                      onClick={() => {
                        onSelect(option);
                        setOpen(false);
                        setQuery('');
                      }}
                      className={`w-full text-left px-3 py-2 hover:bg-gray-800 transition-colors flex items-center gap-2 ${
                        selected?.id === option.id ? 'bg-gray-800' : ''
                      }`}
                    >
                      <span className="text-xs">{option.type === 'mine' ? '⛏' : '⚓'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{option.name}</p>
                        <p className="text-[10px] text-gray-500">{option.country}</p>
                      </div>
                      {option.commodities && filterByCommidity && option.commodities.includes(filterByCommidity) && (
                        <span className="text-[9px] bg-amber-500/10 text-amber-400 px-1 py-0.5 rounded flex-shrink-0">
                          {COMMODITY_CONFIG[filterByCommidity]?.label}
                        </span>
                      )}
                      {option.type === 'sa_port' && (
                        <span className="text-[9px] bg-gray-700 text-gray-400 px-1 py-0.5 rounded flex-shrink-0">FOB</span>
                      )}
                    </button>
                  ))}
                </div>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-sm text-gray-500 p-4 text-center">No results for &quot;{query}&quot;</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// groupStepsByCategory removed — reverse waterfall renders steps directly

// ── Chevron Icon ────────────────────────────────────────────────────────────

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

// DataSourcesPanel removed — reverse waterfall shows quality badges inline per step
