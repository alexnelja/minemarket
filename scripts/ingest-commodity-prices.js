#!/usr/bin/env node
/**
 * Ingest commodity spot prices into commodity_prices table.
 *
 * Sources:
 *   - World Bank Pink Sheet (monthly Excel) — iron ore, coal
 *   - Platform deals (last 90 days)          — chrome, manganese
 *   - Hardcoded benchmark                    — aggregates
 */

const XLSX = require('xlsx');
const https = require('https');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://eawfhchyytnsewgnbznm.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhd2ZoY2h5eXRuc2V3Z25iem5tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzk5NjQ2OSwiZXhwIjoyMDg5NTcyNDY5fQ.57kJ6h03C6bm_z2kHuWazvZ88yiJNsU-qqsd6CF1iP0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const PINK_SHEET_URL = 'https://thedocs.worldbank.org/en/doc/5d903e848db1d1b83e0ec8f744e55570-0350012021/related/CMO-Historical-Data-Monthly.xlsx';

// Benchmark fallbacks (corrected March 2026)
// Chrome: SA 40-42% CIF China ~$315/t (SMM scraper returned wrong $40 value)
// Manganese: SA 37% FOB ~$140/t ($3.80/dmtu × 37% Mn)
const BENCHMARKS = {
  chrome: 315,       // $/t — SA 40-42% Cr2O3 concentrate CIF China
  manganese: 140,    // $/t — SA 37% Mn ore FOB (~$3.80/dmtu × 37)
  aggregates: 15,    // $/t — configured benchmark
};

// ------------------------------------------------------------------
// Download helper
// ------------------------------------------------------------------
function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const get = url.startsWith('https') ? https.get : http.get;
    get(url, (response) => {
      // Follow redirects (302/301)
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close();
        fs.unlinkSync(dest);
        return resolve(download(response.headers.location, dest));
      }
      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        return reject(new Error(`HTTP ${response.statusCode} from ${url}`));
      }
      response.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', (err) => {
      file.close();
      fs.unlinkSync(dest);
      reject(err);
    });
  });
}

// ------------------------------------------------------------------
// Parse World Bank Pink Sheet
// ------------------------------------------------------------------
function parseWorldBankPrices(xlsxPath) {
  const workbook = XLSX.readFile(xlsxPath);
  const sheetName = workbook.SheetNames.find(s =>
    s.toLowerCase().includes('monthly') && s.toLowerCase().includes('price')
  ) || workbook.SheetNames[0];

  console.log(`  Using sheet: "${sheetName}"`);
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // Column indices (0-based): Iron ore cfr = 63, Coal AU = 5, Coal SA = 6
  const COL_IRON_ORE = 63;
  const COL_COAL_AU = 5;
  const COL_COAL_SA = 6;

  // Find data rows — period format like "2024M12"
  const periodRegex = /^\d{4}M\d{1,2}$/;
  const dataRows = rows.filter(r => typeof r[0] === 'string' && periodRegex.test(r[0].trim()));

  // Keep last 24 months
  const recent = dataRows.slice(-24);

  const prices = [];

  for (const row of recent) {
    const period = row[0].trim();

    // Iron ore
    const ironVal = parseFloat(row[COL_IRON_ORE]);
    if (!isNaN(ironVal) && ironVal > 0) {
      prices.push({
        commodity: 'iron_ore',
        price_usd: ironVal,
        unit: 'per_tonne',
        source: 'world_bank',
        period,
      });
    }

    // Coal — average of AU and SA
    const coalAU = parseFloat(row[COL_COAL_AU]);
    const coalSA = parseFloat(row[COL_COAL_SA]);
    const coalVals = [coalAU, coalSA].filter(v => !isNaN(v) && v > 0);
    if (coalVals.length > 0) {
      const avgCoal = coalVals.reduce((a, b) => a + b, 0) / coalVals.length;
      prices.push({
        commodity: 'coal',
        price_usd: Math.round(avgCoal * 100) / 100,
        unit: 'per_tonne',
        source: 'world_bank',
        period,
      });
    }
  }

  return prices;
}

// ------------------------------------------------------------------
// Platform-derived prices (chrome, manganese)
// ------------------------------------------------------------------
async function getPlatformPrices() {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const prices = [];

  for (const commodity of ['chrome', 'manganese']) {
    const { data } = await supabase
      .from('deals')
      .select('agreed_price')
      .eq('commodity_type', commodity)
      .in('status', ['completed', 'escrow_released'])
      .gte('created_at', ninetyDaysAgo);

    const deals = data ?? [];
    let price;
    let source;

    if (deals.length >= 1) {
      price = deals.reduce((sum, d) => sum + Number(d.agreed_price), 0) / deals.length;
      source = 'platform_deals';
    } else {
      price = BENCHMARKS[commodity];
      source = 'benchmark';
    }

    const now = new Date();
    const period = `${now.getFullYear()}M${now.getMonth() + 1}`;

    prices.push({
      commodity,
      price_usd: Math.round(price * 100) / 100,
      unit: 'per_tonne',
      source,
      period,
    });
  }

  // Aggregates — always benchmark
  const now = new Date();
  const period = `${now.getFullYear()}M${now.getMonth() + 1}`;
  prices.push({
    commodity: 'aggregates',
    price_usd: BENCHMARKS.aggregates,
    unit: 'per_tonne',
    source: 'benchmark',
    period,
  });

  return prices;
}

// ------------------------------------------------------------------
// Upsert prices
// ------------------------------------------------------------------
async function upsertPrices(prices) {
  if (prices.length === 0) {
    console.log('  No prices to upsert.');
    return;
  }

  // Delete existing rows for the same commodity+period combinations, then insert
  for (const p of prices) {
    await supabase
      .from('commodity_prices')
      .delete()
      .eq('commodity', p.commodity)
      .eq('period', p.period);
  }

  const { error } = await supabase
    .from('commodity_prices')
    .insert(prices);

  if (error) {
    console.error('  Upsert error:', error.message);
  } else {
    console.log(`  Upserted ${prices.length} price records.`);
  }
}

// ------------------------------------------------------------------
// Main
// ------------------------------------------------------------------
async function main() {
  console.log('=== Commodity Price Ingestion ===\n');

  // 1. World Bank Pink Sheet
  console.log('1. Downloading World Bank Pink Sheet...');
  const tmpFile = path.join(os.tmpdir(), 'cmo-monthly-prices.xlsx');
  try {
    await download(PINK_SHEET_URL, tmpFile);
    console.log('   Downloaded to', tmpFile);

    console.log('2. Parsing World Bank prices...');
    const wbPrices = parseWorldBankPrices(tmpFile);
    console.log(`   Found ${wbPrices.length} World Bank price records.`);

    console.log('3. Upserting World Bank prices...');
    await upsertPrices(wbPrices);
  } catch (err) {
    console.error('   World Bank download/parse failed:', err.message);
    console.log('   Continuing with platform prices only...');
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  }

  // 2. Platform-derived prices
  console.log('4. Fetching platform-derived prices (chrome, manganese, aggregates)...');
  const platformPrices = await getPlatformPrices();
  console.log(`   Found ${platformPrices.length} platform price records.`);

  console.log('5. Upserting platform prices...');
  await upsertPrices(platformPrices);

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
