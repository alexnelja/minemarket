#!/usr/bin/env node
/**
 * Scrapes commodity prices from Trading Economics (free, daily)
 * Covers: Iron Ore, Coal, Gold, Platinum, Copper, Nickel
 * Usage: node scripts/scrape-trading-economics.js
 *
 * Note: Requires playwright - install with: npx playwright install chromium
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://eawfhchyytnsewgnbznm.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhd2ZoY2h5eXRuc2V3Z25iem5tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzk5NjQ2OSwiZXhwIjoyMDg5NTcyNDY5fQ.57kJ6h03C6bm_z2kHuWazvZ88yiJNsU-qqsd6CF1iP0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Mapping from Trading Economics commodity names to our types
const COMMODITY_MAP = {
  'Iron Ore': { commodity: 'iron_ore', unit: 'per_tonne' },
  'Coal': { commodity: 'coal', unit: 'per_tonne' },
  'Gold': { commodity: 'gold', unit: 'per_troy_oz' },
  'Platinum': { commodity: 'platinum', unit: 'per_troy_oz' },
  'Palladium': { commodity: 'palladium', unit: 'per_troy_oz' },
  'Copper': { commodity: 'copper', unit: 'per_tonne' },
  'Nickel': { commodity: 'nickel', unit: 'per_tonne' },
  'Silver': { commodity: 'silver', unit: 'per_troy_oz' },
};

async function main() {
  console.log('Trading Economics Price Scraper');
  console.log('==============================');

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

  try {
    await page.goto('https://tradingeconomics.com/commodities', { timeout: 15000 });
    await page.waitForTimeout(5000);

    // Extract all commodity rows from the table
    const prices = await page.evaluate(() => {
      const rows = document.querySelectorAll('table tr, [class*="row"]');
      const results = [];
      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 3) {
          const name = cells[0]?.textContent?.trim();
          const price = cells[1]?.textContent?.trim();
          if (name && price) {
            results.push({ name, price: parseFloat(price.replace(/,/g, '')) });
          }
        }
      });
      return results;
    });

    console.log(`Found ${prices.length} commodity prices`);

    let ingested = 0;
    const today = new Date().toISOString().slice(0, 10);

    for (const { name, price } of prices) {
      const mapping = COMMODITY_MAP[name];
      if (!mapping || !price || isNaN(price)) continue;

      const { error } = await supabase.from('commodity_prices').insert({
        commodity: mapping.commodity,
        price_usd: price,
        unit: mapping.unit,
        source: 'trading_economics',
        period: today,
        recorded_at: new Date().toISOString(),
      });

      if (!error) {
        ingested++;
        console.log(`  ${name}: $${price} → ${mapping.commodity}`);
      }
    }

    console.log(`\nIngested ${ingested} prices from Trading Economics`);
  } catch (err) {
    console.error('Scraping failed:', err.message);
  } finally {
    await browser.close();
  }
}

main();
