#!/usr/bin/env node
/**
 * Set benchmark commodity prices directly in the database.
 *
 * The SMM scraper returned incorrect values for chrome ($40 instead of ~$315/t)
 * because it scraped from a wrong element on the page. This script sets corrected
 * benchmark prices manually until the scraper is fixed.
 *
 * Usage: node scripts/set-benchmarks.js
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://eawfhchyytnsewgnbznm.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhd2ZoY2h5eXRuc2V3Z25iem5tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzk5NjQ2OSwiZXhwIjoyMDg5NTcyNDY5fQ.57kJ6h03C6bm_z2kHuWazvZ88yiJNsU-qqsd6CF1iP0';

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const today = new Date().toISOString().slice(0, 10);
const now = new Date().toISOString();

// NOTE: SMM scraper (scrape-smm-metals.js) is unreliable — page structure
// makes it hard to extract the correct price vs change/date numbers.
// Until we have a paid API (Asian Metal $1-3K/yr or Trading Economics $50/mo),
// use manual benchmarks updated from SMM website (metal.com/Chromium).
// Last verified: March 2026 — SA 40-42% Chrome Conc CIF China ~$315/t
//
// Corrected benchmark prices (March 2026 estimates)
//
// Chrome: SA 40-42% Cr2O3 concentrate CIF China ~$315/t
//   The SMM scraper returned $40 which was scraped from the wrong element.
//   Real price is visible on Fastmarkets / Metal Bulletin chrome pages.
//
// Manganese: SA 37% Mn ore FOB SA ~$140/t
//   Pricing: ~$3.80/dmtu x 37% = ~$140/t
//   (dmtu = dry metric tonne unit; for Mn ore, price/dmtu x Mn% = price/tonne)
const BENCHMARKS = [
  {
    commodity: 'chrome',
    price_usd: 315,
    unit: 'per_tonne',
    source: 'smm_benchmark',
    period: today,
    recorded_at: now,
  },
  {
    commodity: 'manganese',
    price_usd: 140,
    unit: 'per_tonne',
    source: 'benchmark',
    period: today,
    recorded_at: now,
  },
];

async function main() {
  console.log('Setting benchmark commodity prices...\n');

  for (const benchmark of BENCHMARKS) {
    // Delete any existing stale/incorrect prices from SMM for this commodity
    const { data: existing } = await admin
      .from('commodity_prices')
      .select('id, price_usd, source')
      .eq('commodity', benchmark.commodity)
      .order('recorded_at', { ascending: false })
      .limit(5);

    if (existing && existing.length > 0) {
      console.log(`  ${benchmark.commodity}: existing prices in DB:`);
      for (const row of existing) {
        console.log(`    $${row.price_usd} (source: ${row.source})`);
      }
    }

    // Upsert the corrected benchmark
    const { error } = await admin.from('commodity_prices').upsert(benchmark, {
      onConflict: 'commodity,source,period',
    });

    if (error) {
      // If upsert fails due to missing unique constraint, try delete + insert
      console.log(`  Upsert failed for ${benchmark.commodity} (${error.message}), trying delete+insert...`);
      await admin
        .from('commodity_prices')
        .delete()
        .eq('commodity', benchmark.commodity)
        .eq('source', benchmark.source)
        .eq('period', benchmark.period);

      const { error: insertErr } = await admin.from('commodity_prices').insert(benchmark);
      if (insertErr) {
        console.error(`  FAILED ${benchmark.commodity}: ${insertErr.message}`);
      } else {
        console.log(`  OK ${benchmark.commodity}: $${benchmark.price_usd}/t (${benchmark.source})`);
      }
    } else {
      console.log(`  OK ${benchmark.commodity}: $${benchmark.price_usd}/t (${benchmark.source})`);
    }
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
