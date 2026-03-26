#!/usr/bin/env node
/**
 * One-time vessel enrichment using Datalastic API.
 * Enriches all vessels in vessel_positions with: type, DWT, IMO, flag, dimensions, year built.
 *
 * Usage:
 *   DATALASTIC_API_KEY=your_key node scripts/enrich-vessels-datalastic.js
 *   DATALASTIC_API_KEY=your_key node scripts/enrich-vessels-datalastic.js --dry-run
 *   DATALASTIC_API_KEY=your_key node scripts/enrich-vessels-datalastic.js --limit=100
 *
 * Credits: ~1 per vessel via /vessel_info, or ~1 per 100 via /vessel_bulk
 * Starter plan: 20,000 credits/month
 */

const { createClient } = require('@supabase/supabase-js');

const DATALASTIC_API_KEY = process.env.DATALASTIC_API_KEY;
const SUPABASE_URL = 'https://eawfhchyytnsewgnbznm.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhd2ZoY2h5eXRuc2V3Z25iem5tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzk5NjQ2OSwiZXhwIjoyMDg5NTcyNDY5fQ.57kJ6h03C6bm_z2kHuWazvZ88yiJNsU-qqsd6CF1iP0';

const DATALASTIC_BASE = 'https://api.datalastic.com/api/v0';
const BATCH_SIZE = 100; // /vessel_bulk supports up to 100 per call
const RATE_LIMIT_MS = 500; // 500ms between API calls to be safe

const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '0');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// AIS ship type mapping for fallback
const AIS_SHIP_TYPES = {
  70: 'Cargo', 71: 'Cargo (DG/HS)', 72: 'Cargo (DG/HS)', 73: 'Cargo (DG/HS)', 74: 'Cargo (DG/HS)',
  75: 'Cargo', 76: 'Cargo', 77: 'Cargo', 78: 'Cargo', 79: 'Cargo (no info)',
  80: 'Tanker', 81: 'Tanker (DG/HS)', 82: 'Tanker (DG/HS)', 83: 'Tanker (DG/HS)', 84: 'Tanker (DG/HS)',
  85: 'Tanker', 86: 'Tanker', 87: 'Tanker', 88: 'Tanker', 89: 'Tanker (no info)',
  90: 'Other', 91: 'Tug', 92: 'Tug', 93: 'Port Tender',
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchVesselInfo(mmsi) {
  const url = `${DATALASTIC_BASE}/vessel_info?api-key=${DATALASTIC_API_KEY}&mmsi=${mmsi}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`  API error for MMSI ${mmsi}: ${res.status}`);
    return null;
  }
  const data = await res.json();
  return data?.data || null;
}

async function fetchVesselBulk(mmsiList) {
  // /vessel_bulk accepts comma-separated MMSIs
  const mmsiStr = mmsiList.join(',');
  const url = `${DATALASTIC_BASE}/vessel_infogroup?api-key=${DATALASTIC_API_KEY}&mmsi=${mmsiStr}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`  Bulk API error: ${res.status} ${res.statusText}`);
    // Fallback: try individual lookups
    return null;
  }
  const data = await res.json();
  return data?.data || [];
}

function mapDatalasticToUpdate(vessel) {
  if (!vessel) return null;

  return {
    name: vessel.name?.trim() || undefined,
    imo: vessel.imo ? String(vessel.imo) : undefined,
    ship_type: vessel.type_specific ? (parseInt(vessel.type_specific) || undefined) : undefined,
    vessel_type_name: vessel.type || vessel.type_specific || undefined,
    flag: vessel.country_iso || vessel.country_name || undefined,
    length: vessel.length ? parseFloat(vessel.length) : undefined,
    width: vessel.breadth ? parseFloat(vessel.breadth) : undefined,
    draught: vessel.draught ? parseFloat(vessel.draught) : undefined,
    deadweight: vessel.dwt ? parseFloat(vessel.dwt) : undefined,
  };
}

async function main() {
  if (!DATALASTIC_API_KEY) {
    console.error('ERROR: Set DATALASTIC_API_KEY environment variable');
    console.error('  DATALASTIC_API_KEY=your_key node scripts/enrich-vessels-datalastic.js');
    process.exit(1);
  }

  console.log('Datalastic Vessel Enrichment');
  console.log('============================');
  if (DRY_RUN) console.log('DRY RUN — no database writes');
  console.log();

  // Step 1: Get all vessels that need enrichment (ship_type = 0 or null, or no vessel_type_name)
  console.log('Fetching vessels that need enrichment...');
  let query = supabase
    .from('vessel_positions')
    .select('mmsi, name, ship_type, vessel_type_name, imo, flag, length, deadweight')
    .or('ship_type.eq.0,ship_type.is.null,vessel_type_name.is.null');

  if (LIMIT > 0) query = query.limit(LIMIT);
  else query = query.limit(20000); // Safety cap

  const { data: vessels, error } = await query;
  if (error) {
    console.error('DB error:', error.message);
    process.exit(1);
  }

  console.log(`  Found ${vessels.length} vessels needing enrichment`);

  // Also count already enriched
  const { count: totalCount } = await supabase
    .from('vessel_positions')
    .select('mmsi', { count: 'exact', head: true });
  const { count: enrichedCount } = await supabase
    .from('vessel_positions')
    .select('mmsi', { count: 'exact', head: true })
    .not('vessel_type_name', 'is', null);

  console.log(`  Total vessels: ${totalCount}, already enriched: ${enrichedCount}`);
  console.log();

  if (vessels.length === 0) {
    console.log('All vessels are already enriched!');
    return;
  }

  // Step 2: Extract unique MMSIs
  const mmsiList = [...new Set(vessels.map(v => v.mmsi))];
  console.log(`  Unique MMSIs to look up: ${mmsiList.length}`);

  const estimatedCredits = mmsiList.length;
  const estimatedBatches = Math.ceil(mmsiList.length / BATCH_SIZE);
  const estimatedTime = (estimatedBatches * RATE_LIMIT_MS) / 1000;
  console.log(`  Estimated credits: ${estimatedCredits}`);
  console.log(`  Estimated batches: ${estimatedBatches} (${BATCH_SIZE} per batch)`);
  console.log(`  Estimated time: ${estimatedTime.toFixed(0)}s`);
  console.log();

  if (DRY_RUN) {
    console.log('DRY RUN complete. Remove --dry-run to execute.');
    return;
  }

  // Step 3: Batch lookups
  let enriched = 0;
  let failed = 0;
  let apiCalls = 0;
  let notFound = 0;

  for (let i = 0; i < mmsiList.length; i += BATCH_SIZE) {
    const batch = mmsiList.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    process.stdout.write(`\r  Batch ${batchNum}/${estimatedBatches} (${i}/${mmsiList.length} vessels, ${enriched} enriched, ${failed} failed)`);

    // Try bulk first
    let results = null;
    try {
      results = await fetchVesselBulk(batch);
      apiCalls++;
    } catch (err) {
      console.error(`\n  Bulk request failed: ${err.message}`);
    }

    if (results && Array.isArray(results)) {
      // Map results by MMSI
      const resultMap = new Map();
      for (const r of results) {
        if (r.mmsi) resultMap.set(String(r.mmsi), r);
      }

      // Update each vessel
      for (const mmsi of batch) {
        const vesselData = resultMap.get(mmsi);
        if (vesselData) {
          const update = mapDatalasticToUpdate(vesselData);
          if (update && Object.values(update).some(v => v !== undefined)) {
            // Remove undefined values
            const cleanUpdate = {};
            for (const [k, v] of Object.entries(update)) {
              if (v !== undefined) cleanUpdate[k] = v;
            }

            const { error: updateError } = await supabase
              .from('vessel_positions')
              .update(cleanUpdate)
              .eq('mmsi', mmsi);

            if (!updateError) enriched++;
            else failed++;
          } else {
            notFound++;
          }
        } else {
          notFound++;
        }
      }
    } else {
      // Fallback: individual lookups (costs more credits)
      for (const mmsi of batch) {
        try {
          const vesselData = await fetchVesselInfo(mmsi);
          apiCalls++;

          if (vesselData) {
            const update = mapDatalasticToUpdate(vesselData);
            if (update && Object.values(update).some(v => v !== undefined)) {
              const cleanUpdate = {};
              for (const [k, v] of Object.entries(update)) {
                if (v !== undefined) cleanUpdate[k] = v;
              }

              const { error: updateError } = await supabase
                .from('vessel_positions')
                .update(cleanUpdate)
                .eq('mmsi', mmsi);

              if (!updateError) enriched++;
              else failed++;
            } else {
              notFound++;
            }
          } else {
            notFound++;
          }

          await sleep(RATE_LIMIT_MS);
        } catch (err) {
          failed++;
        }
      }
    }

    await sleep(RATE_LIMIT_MS);
  }

  console.log(`\n\nEnrichment complete!`);
  console.log(`  API calls: ${apiCalls}`);
  console.log(`  Enriched: ${enriched}`);
  console.log(`  Not found: ${notFound}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Estimated credits used: ${apiCalls}`);

  // Final stats
  const { count: newEnrichedCount } = await supabase
    .from('vessel_positions')
    .select('mmsi', { count: 'exact', head: true })
    .not('vessel_type_name', 'is', null);

  console.log(`\n  Enriched vessels: ${enrichedCount} → ${newEnrichedCount}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
