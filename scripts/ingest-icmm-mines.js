#!/usr/bin/env node
/**
 * Ingest ICMM mining dataset into the mines table.
 * Source: scripts/data-sources/icmm-mines.xlsx ("External" sheet)
 * 8,508 mines — filters to bulk mineral commodities only.
 */

const XLSX = require('xlsx');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://eawfhchyytnsewgnbznm.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhd2ZoY2h5eXRuc2V3Z25iem5tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzk5NjQ2OSwiZXhwIjoyMDg5NTcyNDY5fQ.57kJ6h03C6bm_z2kHuWazvZ88yiJNsU-qqsd6CF1iP0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Map ICMM commodity names to our commodity_type enum
const COMMODITY_MAP = {
  'chromium': 'chrome',
  'chrome': 'chrome',
  'chromite': 'chrome',
  'ferrochrome': 'chrome',
  'manganese': 'manganese',
  'ferromanganese': 'manganese',
  'ferrosilicon manganese': 'manganese',
  'iron ore': 'iron_ore',
  'iron': 'iron_ore',
  'thermal coal': 'coal',
  'metallurgical coal': 'coal',
  'coal': 'coal',
  'aggregates': 'aggregates',
  'sand': 'aggregates',
  'gravel': 'aggregates',
  'sand and gravel': 'aggregates',
};

function mapCommodity(raw) {
  if (!raw) return null;
  const lower = raw.toLowerCase().trim();
  return COMMODITY_MAP[lower] || null;
}

async function main() {
  const xlsxPath = path.join(__dirname, 'data-sources', 'icmm-mines.xlsx');
  console.log(`Reading ${xlsxPath}...`);

  const workbook = XLSX.readFile(xlsxPath);
  const sheetName = workbook.SheetNames.find(s => s.toLowerCase().includes('external')) || workbook.SheetNames[0];
  console.log(`Using sheet: "${sheetName}"`);

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
  console.log(`Total rows in sheet: ${rows.length}`);

  let processed = 0;
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  // Process in batches of 200
  const BATCH_SIZE = 200;
  const upsertBatch = [];

  for (const row of rows) {
    processed++;

    // Note: some ICMM headers have trailing spaces (e.g. "Mine Name ")
    const icmmId = String(row['ICMMID'] || '').trim();
    const name = (row['Mine Name'] || row['Mine Name '] || '').trim();
    const lat = parseFloat(row['Latitude'] || 0);
    const lng = parseFloat(row['Longitude'] || 0);
    const country = (row['Country or Region'] || '').trim();
    const confidence = (row['Confidence Factor'] || '').toString().trim();
    const groupNames = (row['Group Names'] || '').toString().trim();
    const primaryRaw = (row['Primary Commodity'] || '').toString().trim();
    const secondaryRaw = (row['Secondary Commodity'] || '').toString().trim();

    const primaryCommodity = mapCommodity(primaryRaw);
    const secondaryCommodity = mapCommodity(secondaryRaw);

    // Skip if no matching primary commodity
    if (!primaryCommodity) {
      skipped++;
      continue;
    }

    // Skip if missing essential data
    if (!name || !icmmId || isNaN(lat) || isNaN(lng)) {
      skipped++;
      continue;
    }

    // Build commodities array (deduped)
    const commodities = [primaryCommodity];
    if (secondaryCommodity && secondaryCommodity !== primaryCommodity) {
      commodities.push(secondaryCommodity);
    }

    // Build secondary_commodities (non-enum raw values for reference)
    const secondaryCommodities = secondaryRaw ? [secondaryRaw] : [];

    upsertBatch.push({
      name,
      location: `SRID=4326;POINT(${lng} ${lat})`,
      country,
      region: '',
      commodities,
      source: 'icmm',
      source_id: icmmId,
      confidence,
      last_verified_at: new Date().toISOString(),
      secondary_commodities: secondaryCommodities,
      group_names: groupNames,
      // Leave nearest_harbour_id and owner_id as null
    });

    // Flush batch
    if (upsertBatch.length >= BATCH_SIZE) {
      const result = await flushBatch(upsertBatch);
      inserted += result.inserted;
      updated += result.updated;
      errors += result.errors;
      upsertBatch.length = 0;

      if (processed % 1000 === 0) {
        console.log(`  Progress: ${processed}/${rows.length} processed, ${inserted} inserted, ${skipped} skipped`);
      }
    }
  }

  // Flush remaining
  if (upsertBatch.length > 0) {
    const result = await flushBatch(upsertBatch);
    inserted += result.inserted;
    updated += result.updated;
    errors += result.errors;
  }

  console.log('\n--- ICMM Ingestion Complete ---');
  console.log(`Total processed: ${processed}`);
  console.log(`Inserted/Updated: ${inserted}`);
  console.log(`Skipped (no matching commodity or missing data): ${skipped}`);
  console.log(`Errors: ${errors}`);
}

async function flushBatch(batch) {
  let inserted = 0;
  let updated = 0;
  let errors = 0;

  // Supabase accepts EWKT format for geography columns
  const records = batch;

  // We need to check which records already exist by source_id
  const sourceIds = records.map(r => r.source_id);
  const { data: existing } = await supabase
    .from('mines')
    .select('id, source_id')
    .eq('source', 'icmm')
    .in('source_id', sourceIds);

  const existingMap = new Map((existing || []).map(e => [e.source_id, e.id]));

  const toInsert = [];
  const toUpdate = [];

  for (const rec of records) {
    const existingId = existingMap.get(rec.source_id);
    if (existingId) {
      toUpdate.push({ id: existingId, ...rec });
    } else {
      toInsert.push(rec);
    }
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from('mines').insert(toInsert);
    if (error) {
      console.error(`  Insert error: ${error.message}`);
      errors += toInsert.length;
    } else {
      inserted += toInsert.length;
    }
  }

  if (toUpdate.length > 0) {
    // Update in smaller chunks to avoid issues
    for (const rec of toUpdate) {
      const { id, ...updateData } = rec;
      const { error } = await supabase.from('mines').update(updateData).eq('id', id);
      if (error) {
        console.error(`  Update error for ${rec.source_id}: ${error.message}`);
        errors++;
      } else {
        updated++;
      }
    }
    inserted += toUpdate.length - errors;
  }

  return { inserted, updated, errors };
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
