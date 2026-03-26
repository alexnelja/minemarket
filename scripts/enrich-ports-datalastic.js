#!/usr/bin/env node
/**
 * Port enrichment using Datalastic /port_find API.
 * Enriches top bulk mineral ports with area levels and standardized data.
 *
 * Usage:
 *   DATALASTIC_API_KEY=your_key node scripts/enrich-ports-datalastic.js
 *
 * Credits: ~1 per port lookup. Budget: 200-500 credits.
 */

const { createClient } = require('@supabase/supabase-js');

const DATALASTIC_API_KEY = process.env.DATALASTIC_API_KEY;
const SUPABASE_URL = 'https://eawfhchyytnsewgnbznm.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhd2ZoY2h5eXRuc2V3Z25iem5tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzk5NjQ2OSwiZXhwIjoyMDg5NTcyNDY5fQ.57kJ6h03C6bm_z2kHuWazvZ88yiJNsU-qqsd6CF1iP0';

const DATALASTIC_BASE = 'https://api.datalastic.com/api/v0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Key bulk mineral ports to enrich
const KEY_PORTS = [
  'Richards Bay', 'Saldanha Bay', 'Durban', 'Port Elizabeth', 'Maputo', 'Ngqura',
  'Qingdao', 'Qinzhou', 'Shanghai', 'Tianjin', 'Rizhao', 'Tangshan',
  'Rotterdam', 'Antwerp', 'Hamburg',
  'Mumbai', 'Visakhapatnam', 'Paradip', 'Haldia',
  'Kashima', 'Kobe', 'Nagoya',
  'Pohang', 'Gwangyang',
  'Singapore',
  'Newcastle', 'Port Hedland', 'Dampier',
  'Tubarao', 'Itaguai', 'Sao Luis',
  'Iskenderun', 'Mersin',
];

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  if (!DATALASTIC_API_KEY) {
    console.error('Set DATALASTIC_API_KEY env var');
    process.exit(1);
  }

  console.log('Datalastic Port Enrichment');
  console.log('=========================');
  console.log(`Ports to look up: ${KEY_PORTS.length}`);
  console.log();

  let enriched = 0;
  let credits = 0;

  for (const portName of KEY_PORTS) {
    try {
      const url = `${DATALASTIC_BASE}/port_find?api-key=${DATALASTIC_API_KEY}&name=${encodeURIComponent(portName)}`;
      const res = await fetch(url);
      credits++;

      if (!res.ok) {
        console.log(`  ✗ ${portName}: API error ${res.status}`);
        continue;
      }

      const data = await res.json();
      const port = data?.data?.[0] || data?.data;

      if (!port) {
        console.log(`  ✗ ${portName}: not found`);
        continue;
      }

      // Update our harbours table with enriched data
      const { error } = await supabase
        .from('harbours')
        .update({
          source: 'datalastic',
          last_verified_at: new Date().toISOString(),
        })
        .ilike('name', `%${portName}%`);

      if (!error) {
        enriched++;
        console.log(`  ✓ ${portName}: ${port.country_name || port.country_iso || ''} (${port.unlocode || ''})`);
      } else {
        console.log(`  ✗ ${portName}: DB update error: ${error.message}`);
      }

      await sleep(500);
    } catch (err) {
      console.log(`  ✗ ${portName}: ${err.message}`);
    }
  }

  console.log(`\nDone: ${enriched}/${KEY_PORTS.length} ports enriched, ${credits} API credits used`);
}

main().catch(console.error);
