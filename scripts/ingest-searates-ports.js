#!/usr/bin/env node
/**
 * Ingest sea ports into the harbours table.
 *
 * Data sources (in priority order):
 * 1. SeaRates API (requires API key — placeholder, commented out)
 * 2. `sea-ports` npm package (interim fallback)
 *
 * Filters to countries relevant to bulk mineral trade.
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://eawfhchyytnsewgnbznm.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhd2ZoY2h5eXRuc2V3Z25iem5tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzk5NjQ2OSwiZXhwIjoyMDg5NTcyNDY5fQ.57kJ6h03C6bm_z2kHuWazvZ88yiJNsU-qqsd6CF1iP0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Countries relevant to bulk mineral trade
const RELEVANT_COUNTRIES = new Set([
  // Africa
  'ZA', 'MZ', 'NA', 'GH', 'TZ', 'KE', 'NG', 'SN', 'CI', 'GA', 'CM', 'CG', 'CD', 'AO', 'DZ', 'MA', 'EG', 'MG',
  // Asia-Pacific (major importers)
  'CN', 'IN', 'JP', 'KR', 'TW', 'VN', 'TH', 'MY', 'ID', 'PH', 'PK', 'BD', 'LK',
  // Oceania
  'AU', 'NZ',
  // Americas
  'BR', 'CL', 'PE', 'MX', 'US', 'CA', 'AR', 'CO',
  // Europe
  'TR', 'GB', 'NL', 'BE', 'DE', 'FR', 'ES', 'IT', 'GR', 'PL', 'RO', 'HR', 'SI', 'BG', 'PT', 'SE', 'FI', 'NO',
  // Middle East
  'AE', 'SA', 'OM', 'QA', 'BH', 'KW', 'IR', 'IQ', 'JO', 'IL',
]);

/*
 * --- SeaRates API (placeholder) ---
 * When you have a SeaRates API key, uncomment and use:
 *
 * const SEARATES_API_KEY = process.env.SEARATES_API_KEY;
 * const SEARATES_BASE_URL = 'https://sirius.searates.com/port/api';
 *
 * async function fetchFromSeaRates() {
 *   const response = await fetch(`${SEARATES_BASE_URL}/ports?api_key=${SEARATES_API_KEY}`);
 *   const data = await response.json();
 *   return data.ports.map(p => ({
 *     name: p.name,
 *     country: p.country_code,
 *     lat: p.lat,
 *     lng: p.lng,
 *     unlocode: p.unlocode,
 *     type: p.type,
 *   }));
 * }
 */

// Map full country names to ISO 2-letter codes for the sea-ports package
const COUNTRY_NAME_TO_CODE = {
  'south africa': 'ZA', 'mozambique': 'MZ', 'namibia': 'NA', 'ghana': 'GH', 'tanzania': 'TZ',
  'kenya': 'KE', 'nigeria': 'NG', 'senegal': 'SN', "côte d'ivoire": 'CI', 'ivory coast': 'CI',
  'gabon': 'GA', 'cameroon': 'CM', 'congo': 'CG', 'democratic republic of the congo': 'CD',
  'angola': 'AO', 'algeria': 'DZ', 'morocco': 'MA', 'egypt': 'EG', 'madagascar': 'MG',
  'china': 'CN', 'india': 'IN', 'japan': 'JP', 'south korea': 'KR', 'korea': 'KR',
  'taiwan': 'TW', 'vietnam': 'VN', 'thailand': 'TH', 'malaysia': 'MY', 'indonesia': 'ID',
  'philippines': 'PH', 'pakistan': 'PK', 'bangladesh': 'BD', 'sri lanka': 'LK',
  'australia': 'AU', 'new zealand': 'NZ',
  'brazil': 'BR', 'chile': 'CL', 'peru': 'PE', 'mexico': 'MX', 'united states': 'US',
  'united states of america': 'US', 'canada': 'CA', 'argentina': 'AR', 'colombia': 'CO',
  'turkey': 'TR', 'türkiye': 'TR', 'united kingdom': 'GB', 'netherlands': 'NL', 'belgium': 'BE',
  'germany': 'DE', 'france': 'FR', 'spain': 'ES', 'italy': 'IT', 'greece': 'GR',
  'poland': 'PL', 'romania': 'RO', 'croatia': 'HR', 'slovenia': 'SI', 'bulgaria': 'BG',
  'portugal': 'PT', 'sweden': 'SE', 'finland': 'FI', 'norway': 'NO',
  'united arab emirates': 'AE', 'saudi arabia': 'SA', 'oman': 'OM', 'qatar': 'QA',
  'bahrain': 'BH', 'kuwait': 'KW', 'iran': 'IR', 'iraq': 'IQ', 'jordan': 'JO', 'israel': 'IL',
};

async function fetchFromNpmPackage() {
  let seaPorts;
  try {
    seaPorts = require('sea-ports');
  } catch (e) {
    console.error('sea-ports package not installed. Run: npm install sea-ports');
    process.exit(1);
  }

  // sea-ports.JSON is an object keyed by UNLOCODE, each value has:
  // { name, city, country (full name), coordinates: [lng, lat], unlocs, province, ... }
  const portsObj = seaPorts.JSON;
  const entries = Object.entries(portsObj);
  console.log(`sea-ports package contains ${entries.length} ports total`);

  const filtered = [];
  for (const [unloc, p] of entries) {
    // Resolve country code from full name
    const countryName = (p.country || '').toLowerCase().trim();
    const countryCode = COUNTRY_NAME_TO_CODE[countryName] || unloc.substring(0, 2);

    if (!RELEVANT_COUNTRIES.has(countryCode)) continue;

    // Must have coordinates
    const coords = p.coordinates;
    if (!coords || !Array.isArray(coords) || coords.length < 2) continue;

    const lng = parseFloat(coords[0]);
    const lat = parseFloat(coords[1]);
    if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) continue;

    filtered.push({
      name: p.name || p.city || unloc,
      country: countryCode,
      lat,
      lng,
      unlocode: unloc,
      type: 'seaport',
    });
  }

  return filtered;
}

async function main() {
  console.log('Fetching ports from sea-ports npm package...');
  const ports = await fetchFromNpmPackage();
  console.log(`Filtered to ${ports.length} relevant ports`);

  if (ports.length === 0) {
    console.log('No ports to insert. Check the sea-ports package data format.');
    // Debug: print first raw port
    try {
      const sp = require('sea-ports');
      const all = typeof sp.getList === 'function' ? sp.getList() : typeof sp.JSON === 'object' ? sp.JSON : Array.isArray(sp) ? sp : Object.values(sp);
      if (all.length > 0) {
        console.log('Sample port object:', JSON.stringify(all[0], null, 2));
      }
    } catch (e) { /* ignore */ }
    process.exit(1);
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  // Process in batches
  const BATCH_SIZE = 100;

  for (let i = 0; i < ports.length; i += BATCH_SIZE) {
    const batch = ports.slice(i, i + BATCH_SIZE);

    const records = batch
      .filter(p => p.name && (p.lat || p.lng))
      .map(p => ({
        name: p.name,
        location: `SRID=4326;POINT(${p.lng} ${p.lat})`,
        country: p.country,
        type: 'both',  // harbour_type enum: 'loading' | 'destination' | 'both'
        source: 'sea-ports-npm',
        source_id: p.unlocode || `${p.country}-${p.name}`.substring(0, 50),
        last_verified_at: new Date().toISOString(),
        unlocode: p.unlocode || null,
      }));

    if (records.length === 0) continue;

    // Check for existing by source_id
    const sourceIds = records.map(r => r.source_id);
    const { data: existing } = await supabase
      .from('harbours')
      .select('id, source_id')
      .in('source_id', sourceIds);

    const existingMap = new Map((existing || []).map(e => [e.source_id, e.id]));

    const toInsert = [];
    for (const rec of records) {
      if (existingMap.has(rec.source_id)) {
        updated++;
        // Could update here, but skip for now — existing data is fine
      } else {
        toInsert.push(rec);
      }
    }

    if (toInsert.length > 0) {
      const { error } = await supabase.from('harbours').insert(toInsert);
      if (error) {
        console.error(`  Batch insert error: ${error.message}`);
        // Try one by one
        for (const rec of toInsert) {
          const { error: singleErr } = await supabase.from('harbours').insert([rec]);
          if (singleErr) {
            errors++;
          } else {
            inserted++;
          }
        }
      } else {
        inserted += toInsert.length;
      }
    }

    if ((i + BATCH_SIZE) % 500 === 0 || i + BATCH_SIZE >= ports.length) {
      console.log(`  Progress: ${Math.min(i + BATCH_SIZE, ports.length)}/${ports.length} processed`);
    }
  }

  console.log('\n--- Port Ingestion Complete ---');
  console.log(`Total ports: ${ports.length}`);
  console.log(`Inserted: ${inserted}`);
  console.log(`Already existed: ${updated}`);
  console.log(`Errors: ${errors}`);

  // Final count
  const { count } = await supabase.from('harbours').select('*', { count: 'exact', head: true });
  console.log(`Total harbours in DB: ${count}`);
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
