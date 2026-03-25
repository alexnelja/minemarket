#!/usr/bin/env node
/**
 * Ingest African rail network from GeoPackage into Supabase.
 * Source: scripts/data-sources/africa_railways.gpkg (AFTS database)
 * ~6,200 stations, ~51,000 edge segments
 */

const Database = require('better-sqlite3');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://eawfhchyytnsewgnbznm.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhd2ZoY2h5eXRuc2V3Z25iem5tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzk5NjQ2OSwiZXhwIjoyMDg5NTcyNDY5fQ.57kJ6h03C6bm_z2kHuWazvZ88yiJNsU-qqsd6CF1iP0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const BATCH_SIZE = 500;

async function upsertBatch(table, records) {
  const { error } = await supabase
    .from(table)
    .upsert(records, { onConflict: 'id' });
  if (error) {
    console.error(`  Error upserting to ${table}: ${error.message}`);
    return 0;
  }
  return records.length;
}

async function main() {
  const gpkgPath = path.join(__dirname, 'data-sources', 'africa_railways.gpkg');
  console.log(`Opening ${gpkgPath}...`);
  const db = new Database(gpkgPath, { readonly: true });

  // --- Stations ---
  console.log('\n=== Ingesting Rail Stations ===');
  const stationRows = db.prepare(`
    SELECT n.id, n.name, n.infra, n.facility, n.country,
           r.minx AS lng, r.miny AS lat
    FROM nodes n
    JOIN rtree_nodes_geom r ON n.fid = r.id
    WHERE n.infra IN ('station', 'halt', 'stop')
       OR n.facility IS NOT NULL
       OR (n.name IS NOT NULL AND n.name != '')
  `).all();

  console.log(`Found ${stationRows.length} station nodes`);

  let stationCount = 0;
  let batch = [];

  for (const row of stationRows) {
    batch.push({
      id: row.id,
      name: row.name || null,
      lat: row.lat,
      lng: row.lng,
      country: row.country || null,
      infra_type: row.infra || null,
      facility_type: row.facility || null,
      source: 'afts-db',
      last_verified_at: new Date().toISOString(),
    });

    if (batch.length >= BATCH_SIZE) {
      stationCount += await upsertBatch('rail_stations', batch);
      console.log(`  Stations: ${stationCount}/${stationRows.length}`);
      batch = [];
    }
  }

  if (batch.length > 0) {
    stationCount += await upsertBatch('rail_stations', batch);
  }
  console.log(`Stations ingested: ${stationCount}`);

  // --- Edge Segments ---
  console.log('\n=== Ingesting Rail Segments ===');

  // Check available edge columns
  const edgeCols = db.pragma('table_info(edges)');
  const colNames = edgeCols.map(c => c.name);
  const hasLengthM = colNames.includes('length_m');
  console.log(`Edge columns: ${colNames.join(', ')}`);
  console.log(`Has length_m: ${hasLengthM}`);

  const lengthExpr = hasLengthM ? 'e.length_m' : 'NULL';
  const edgeRows = db.prepare(`
    SELECT e.id, e.from_id, e.to_id, e.country, ${lengthExpr} AS length_m
    FROM edges e
  `).all();

  console.log(`Found ${edgeRows.length} edge segments`);

  let segmentCount = 0;
  batch = [];

  for (const row of edgeRows) {
    batch.push({
      id: row.id,
      from_station_id: row.from_id || null,
      to_station_id: row.to_id || null,
      country: row.country || null,
      length_km: row.length_m != null ? Math.round((row.length_m / 1000) * 1000) / 1000 : null,
      source: 'afts-db',
    });

    if (batch.length >= BATCH_SIZE) {
      segmentCount += await upsertBatch('rail_segments', batch);
      console.log(`  Segments: ${segmentCount}/${edgeRows.length}`);
      batch = [];
    }
  }

  if (batch.length > 0) {
    segmentCount += await upsertBatch('rail_segments', batch);
  }
  console.log(`Segments ingested: ${segmentCount}`);

  db.close();

  console.log('\n--- Rail Network Ingestion Complete ---');
  console.log(`Stations: ${stationCount}`);
  console.log(`Segments: ${segmentCount}`);
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
