#!/usr/bin/env node
/**
 * Scrapes commodity prices from Shanghai Metals Market (metal.com) — free tier
 * Covers: Chrome ore (SA 40-42%, Turkey 46-48%), Ferrochrome, Manganese, Vanadium
 * Usage: node scripts/scrape-smm-metals.js
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://eawfhchyytnsewgnbznm.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhd2ZoY2h5eXRuc2V3Z25iem5tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzk5NjQ2OSwiZXhwIjoyMDg5NTcyNDY5fQ.57kJ6h03C6bm_z2kHuWazvZ88yiJNsU-qqsd6CF1iP0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Pages to scrape and their commodity mappings
const SMM_PAGES = [
  {
    url: 'https://www.metal.com/Chromium',
    patterns: [
      { match: /south africa 40-42%.*concentrate.*cif/i, commodity: 'chrome', subtype: 'chrome_met_conc', unit: 'per_tonne' },
      { match: /south africa 40-42%.*crude.*cif/i, commodity: 'chrome', subtype: 'chrome_met_lumpy', unit: 'per_tonne' },
      { match: /turkey 46-48%.*concentrate.*cif/i, commodity: 'chrome', subtype: 'chrome_chem_lg6', unit: 'per_tonne' },
    ],
  },
  {
    url: 'https://www.metal.com/Manganese',
    patterns: [
      { match: /south africa.*37%.*mn.*ore/i, commodity: 'manganese', subtype: 'mn_medium_grade', unit: 'per_tonne' },
      { match: /south africa.*44%.*mn.*ore/i, commodity: 'manganese', subtype: 'mn_high_grade', unit: 'per_tonne' },
      { match: /ferromanganese|FeMn/i, commodity: 'manganese', subtype: 'mn_hc_femn', unit: 'per_tonne' },
    ],
  },
  {
    url: 'https://www.metal.com/Vanadium',
    patterns: [
      { match: /v2o5.*98%|vanadium.*pentoxide/i, commodity: 'vanadium', subtype: 'v_v2o5_flake', unit: 'per_lb' },
      { match: /ferrovanadium|fev/i, commodity: 'vanadium', subtype: 'v_fev80', unit: 'per_tonne' },
    ],
  },
];

async function main() {
  console.log('SMM Metal.com Price Scraper');
  console.log('==========================');

  let chromium;
  try {
    const pw = require('playwright');
    chromium = pw.chromium;
  } catch {
    console.error('Playwright not installed. Run: npx playwright install chromium');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  let totalIngested = 0;
  const today = new Date().toISOString().slice(0, 10);

  for (const smmPage of SMM_PAGES) {
    console.log(`\nFetching: ${smmPage.url}`);
    try {
      await page.goto(smmPage.url, { timeout: 15000 });
      await page.waitForTimeout(5000);

      const text = await page.textContent('body');
      if (!text) continue;

      // Extract price rows — SMM format: "Product Name ... USD/tonne ... price ... date"
      // Try to find numeric prices near pattern matches
      for (const pattern of smmPage.patterns) {
        // Find the text segment matching the pattern
        const regex = new RegExp(pattern.match.source + '[^\\n]{0,200}', 'i');
        const match = text.match(regex);
        if (!match) {
          console.log(`  ✗ ${pattern.subtype}: no match`);
          continue;
        }

        // Extract numbers that look like prices (3-5 digits)
        const priceMatch = match[0].match(/\b(\d{2,5}(?:\.\d{1,2})?)\b/);
        if (!priceMatch) {
          console.log(`  ✗ ${pattern.subtype}: matched text but no price found`);
          continue;
        }

        const price = parseFloat(priceMatch[1]);
        if (price < 5 || price > 50000) continue; // Sanity check

        const { error } = await supabase.from('commodity_prices').insert({
          commodity: pattern.commodity,
          price_usd: price,
          unit: pattern.unit,
          source: 'smm',
          period: today,
          recorded_at: new Date().toISOString(),
        });

        if (!error) {
          totalIngested++;
          console.log(`  ✓ ${pattern.subtype}: $${price}/${pattern.unit.replace('per_', '')}`);
        }
      }
    } catch (err) {
      console.error(`  Error on ${smmPage.url}: ${err.message}`);
    }
  }

  await browser.close();
  console.log(`\nIngested ${totalIngested} prices from SMM`);
}

main();
