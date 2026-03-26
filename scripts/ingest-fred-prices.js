#!/usr/bin/env node
/**
 * Fetches commodity prices from FRED (Federal Reserve Economic Data) — free API
 * Covers: Iron Ore (monthly), Coal (monthly)
 * Usage: node scripts/ingest-fred-prices.js
 * No API key needed for limited requests.
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://eawfhchyytnsewgnbznm.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhd2ZoY2h5eXRuc2V3Z25iem5tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzk5NjQ2OSwiZXhwIjoyMDg5NTcyNDY5fQ.57kJ6h03C6bm_z2kHuWazvZ88yiJNsU-qqsd6CF1iP0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// FRED series IDs
const FRED_SERIES = [
  { id: 'PIORECRUSDM', commodity: 'iron_ore', unit: 'per_tonne', label: 'Iron Ore CFR China (62% Fe)' },
  { id: 'PCOALAUUSDM', commodity: 'coal', unit: 'per_tonne', label: 'Coal, Australian (Newcastle)' },
  { id: 'PCOALSA', commodity: 'coal', unit: 'per_tonne', label: 'Coal, South African (API4)' },
];

// FRED API key (free, get from https://fred.stlouisfed.org/docs/api/api_key.html)
// Without key: limited to ~60 requests/hour
const FRED_API_KEY = process.env.FRED_API_KEY || '';

async function fetchFredSeries(seriesId) {
  const keyParam = FRED_API_KEY ? `&api_key=${FRED_API_KEY}` : '';
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&sort_order=desc&limit=24&file_type=json${keyParam}`;

  const res = await fetch(url);
  if (!res.ok) {
    // Without API key, try alternative: IMF data
    console.log(`  FRED returned ${res.status} — may need API key`);
    return [];
  }

  const data = await res.json();
  return (data.observations || [])
    .filter(o => o.value !== '.' && o.value !== '')
    .map(o => ({ date: o.date, value: parseFloat(o.value) }));
}

async function main() {
  console.log('FRED Commodity Price Ingestion');
  console.log('=============================');
  if (!FRED_API_KEY) console.log('Note: No FRED_API_KEY set — using limited access\n');

  let totalIngested = 0;

  for (const series of FRED_SERIES) {
    console.log(`Fetching: ${series.label} (${series.id})`);
    const observations = await fetchFredSeries(series.id);

    if (observations.length === 0) {
      console.log('  No data returned');
      continue;
    }

    // Delete old FRED entries for this commodity
    await supabase.from('commodity_prices')
      .delete()
      .eq('commodity', series.commodity)
      .eq('source', 'fred');

    // Insert
    const rows = observations.map(o => ({
      commodity: series.commodity,
      price_usd: o.value,
      unit: series.unit,
      source: 'fred',
      period: o.date,
      recorded_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from('commodity_prices').insert(rows);
    if (!error) {
      totalIngested += rows.length;
      console.log(`  ✓ ${rows.length} data points (latest: $${observations[0].value} on ${observations[0].date})`);
    } else {
      console.log(`  ✗ Insert error: ${error.message}`);
    }
  }

  console.log(`\nIngested ${totalIngested} prices from FRED`);
}

main();
