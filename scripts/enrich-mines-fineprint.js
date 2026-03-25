#!/usr/bin/env node
/**
 * Enrich mines in Supabase with FINEPRINT production, reserves, capacity,
 * ownership, and transport data.
 *
 * Data flow:
 *   1. Read mines (source='icmm') from Supabase
 *   2. Read FINEPRINT facilities.csv (extracted from facilities.gpkg) for names
 *   3. Fuzzy-match FINEPRINT facilities to our mines by name similarity
 *   4. For each match, look up latest-year data from FINEPRINT CSVs
 *   5. Update mine records in Supabase
 *
 * FINEPRINT source: https://www.fineprint.global/
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://eawfhchyytnsewgnbznm.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhd2ZoY2h5eXRuc2V3Z25iem5tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzk5NjQ2OSwiZXhwIjoyMDg5NTcyNDY5fQ.57kJ6h03C6bm_z2kHuWazvZ88yiJNsU-qqsd6CF1iP0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const DATA_DIR = path.join(__dirname, 'data-sources', 'data');

// ---------------------------------------------------------------------------
// CSV parsing (handles quoted fields with commas)
// ---------------------------------------------------------------------------
function parseCsv(text) {
  const lines = text.trim().split('\n');
  const headers = parseCsvLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = (values[idx] || '').trim();
    });
    rows.push(row);
  }
  return rows;
}

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ---------------------------------------------------------------------------
// Name matching
// ---------------------------------------------------------------------------
const STRIP_SUFFIXES = [
  'mine', 'mines', 'project', 'operation', 'operations', 'complex',
  'colliery', 'pit', 'open pit', 'underground', 'ug', 'opencast',
  'section', 'shaft', 'plant', 'processing', 'smelter', 'refinery',
];

function normalizeName(name) {
  if (!name) return '';
  let n = name.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  // Strip common suffixes
  for (const suffix of STRIP_SUFFIXES) {
    n = n.replace(new RegExp(`\\b${suffix}\\b`, 'g'), '');
  }
  return n.replace(/\s+/g, ' ').trim();
}

function nameMatchScore(a, b) {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;

  // Exact match after normalization
  if (na === nb) return 1.0;

  // Containment
  if (na.includes(nb) || nb.includes(na)) return 0.85;

  // Word overlap
  const wordsA = na.split(/\s+/).filter(w => w.length > 1);
  const wordsB = nb.split(/\s+/).filter(w => w.length > 1);
  if (wordsA.length === 0 || wordsB.length === 0) return 0;

  const setA = new Set(wordsA);
  const setB = new Set(wordsB);
  let intersection = 0;
  for (const w of setA) {
    if (setB.has(w)) intersection++;
  }

  const union = new Set([...setA, ...setB]).size;
  const wordOverlap = intersection / union;

  // Check if first distinctive word matches (mine names usually start with proper noun)
  const firstA = wordsA[0];
  const firstB = wordsB[0];
  const firstBonus = firstA === firstB ? 0.15 : 0;

  return Math.min(1, wordOverlap + firstBonus);
}

// ---------------------------------------------------------------------------
// Data loading helpers
// ---------------------------------------------------------------------------
function loadCsv(filename) {
  const filepath = path.join(DATA_DIR, filename);
  const text = fs.readFileSync(filepath, 'utf-8');
  return parseCsv(text);
}

/** Group rows by facility_id, keeping only the latest year per facility. */
function latestByFacility(rows, yearField = 'year') {
  const map = new Map(); // facility_id -> { year, rows[] }
  for (const row of rows) {
    const fid = row.facility_id;
    const yr = parseInt(row[yearField], 10) || 0;
    const entry = map.get(fid);
    if (!entry || yr > entry.year) {
      map.set(fid, { year: yr, rows: [row] });
    } else if (entry && yr === entry.year) {
      entry.rows.push(row);
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('=== FINEPRINT Mine Enrichment ===\n');

  // 1. Load FINEPRINT facilities (names + IDs)
  console.log('Loading FINEPRINT facilities...');
  const facilities = loadCsv('facilities.csv');
  console.log(`  ${facilities.length} facilities loaded`);

  // Build facility lookup by ID
  const facilityById = new Map();
  for (const f of facilities) {
    facilityById.set(f.facility_id, f);
  }

  // 2. Load FINEPRINT data tables
  console.log('Loading FINEPRINT data CSVs...');
  const commoditiesRows = loadCsv('commodities.csv');
  const ownershipRows = loadCsv('ownership.csv');
  const reservesRows = loadCsv('reserves.csv');
  const capacityRows = loadCsv('capacity.csv');
  const transportRows = loadCsv('transport.csv');

  console.log(`  commodities: ${commoditiesRows.length} rows`);
  console.log(`  ownership:   ${ownershipRows.length} rows`);
  console.log(`  reserves:    ${reservesRows.length} rows`);
  console.log(`  capacity:    ${capacityRows.length} rows`);
  console.log(`  transport:   ${transportRows.length} rows`);

  // Group by facility, latest year
  const latestCommodities = latestByFacility(commoditiesRows);
  const latestOwnership = latestByFacility(ownershipRows);
  const latestReserves = latestByFacility(reservesRows);
  const latestCapacity = latestByFacility(capacityRows);
  const latestTransport = latestByFacility(transportRows);

  // 3. Fetch ICMM mines from Supabase
  console.log('\nFetching ICMM mines from Supabase...');
  let allMines = [];
  let page = 0;
  const PAGE_SIZE = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('mines')
      .select('id, name, source, source_id, country, commodities')
      .eq('source', 'icmm')
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (error) {
      console.error('Error fetching mines:', error.message);
      break;
    }
    if (!data || data.length === 0) break;
    allMines = allMines.concat(data);
    page++;
  }

  console.log(`  ${allMines.length} ICMM mines in database`);

  if (allMines.length === 0) {
    console.log('No ICMM mines found. Run ingest:mines first.');
    process.exit(0);
  }

  // 4. Pre-compute normalized names for fast matching
  console.log('\nPre-computing normalized names...');

  // Pre-normalize all facility names (main + alternates)
  const fpNormalized = []; // { facility, normalizedName, normalizedWords, firstWord }
  for (const fp of facilities) {
    const names = [fp.facility_name];
    if (fp.facility_other_names) {
      names.push(...fp.facility_other_names.split(';').map(s => s.trim()).filter(Boolean));
    }
    for (const name of names) {
      const n = normalizeName(name);
      if (!n) continue;
      const words = n.split(/\s+/).filter(w => w.length > 1);
      fpNormalized.push({
        facility: fp,
        normalized: n,
        words,
        wordSet: new Set(words),
        firstWord: words[0] || '',
      });
    }
  }
  console.log(`  ${fpNormalized.length} facility name variants prepared`);

  // Pre-normalize mine names
  const mineNormalized = allMines.map(mine => {
    const n = normalizeName(mine.name);
    const words = n.split(/\s+/).filter(w => w.length > 1);
    return {
      mine,
      normalized: n,
      words,
      wordSet: new Set(words),
      firstWord: words[0] || '',
    };
  });

  // Match mines to FINEPRINT facilities
  console.log('Matching mines to FINEPRINT facilities...');
  const MATCH_THRESHOLD = 0.7;
  let matched = 0;
  let enriched = 0;
  let errors = 0;
  const matchDetails = [];

  for (const mn of mineNormalized) {
    let bestScore = 0;
    let bestFacility = null;

    const na = mn.normalized;
    if (!na) continue;

    for (const fpn of fpNormalized) {
      const nb = fpn.normalized;

      // Exact match
      if (na === nb) {
        bestScore = 1.0;
        bestFacility = fpn.facility;
        break;
      }

      // Containment — only count if the shorter string has at least 2 words
      // and the contained string is at least 5 chars (avoid "coal" matching everything)
      const shorter = na.length <= nb.length ? na : nb;
      const longer = na.length <= nb.length ? nb : na;
      if (shorter.length >= 5 && longer.includes(shorter)) {
        const shorterWords = shorter.split(/\s+/).filter(w => w.length > 1);
        // Require at least 2 meaningful words or the shorter string IS the core name
        if (shorterWords.length >= 2 || shorter.length >= 8) {
          if (0.85 > bestScore) {
            bestScore = 0.85;
            bestFacility = fpn.facility;
          }
          continue;
        }
      }

      // Quick skip: if first words differ AND no word overlap possible, skip
      if (mn.firstWord !== fpn.firstWord && mn.wordSet.size > 0 && fpn.wordSet.size > 0) {
        let hasOverlap = false;
        for (const w of mn.wordSet) {
          if (fpn.wordSet.has(w)) { hasOverlap = true; break; }
        }
        if (!hasOverlap) continue;
      }

      // Word overlap (Jaccard + first-word bonus)
      let intersection = 0;
      for (const w of mn.wordSet) {
        if (fpn.wordSet.has(w)) intersection++;
      }
      const union = new Set([...mn.wordSet, ...fpn.wordSet]).size;
      if (union === 0) continue;
      const jaccard = intersection / union;
      const firstBonus = mn.firstWord === fpn.firstWord ? 0.15 : 0;
      const score = Math.min(1, jaccard + firstBonus);

      if (score > bestScore) {
        bestScore = score;
        bestFacility = fpn.facility;
      }
    }

    if (bestScore < MATCH_THRESHOLD || !bestFacility) continue;
    const mine = mn.mine;

    matched++;
    const fid = bestFacility.facility_id;

    // Build enrichment data
    const update = {};

    // Production (sum all commodity tonnes for the latest year)
    const prodEntry = latestCommodities.get(fid);
    if (prodEntry) {
      let totalTonnes = 0;
      for (const r of prodEntry.rows) {
        const val = parseFloat(r.value_tonnes);
        if (!isNaN(val)) totalTonnes += val;
      }
      if (totalTonnes > 0) {
        update.annual_production_tonnes = Math.round(totalTonnes * 100) / 100;
        update.production_year = prodEntry.year;
      }
    }

    // Reserves (sum mineral_value_tonnes for latest year)
    const resEntry = latestReserves.get(fid);
    if (resEntry) {
      let totalReserves = 0;
      for (const r of resEntry.rows) {
        const val = parseFloat(r.mineral_value_tonnes);
        if (!isNaN(val)) totalReserves += val;
      }
      if (totalReserves > 0) {
        // Reserves often repeat the same mineral_value_tonnes across commodity rows
        // (one mineral can produce multiple commodities). Deduplicate.
        const uniqueReserves = new Set(resEntry.rows.map(r => r.mineral_value_tonnes));
        if (uniqueReserves.size < resEntry.rows.length) {
          // Likely duplicated — take the max unique value
          totalReserves = Math.max(...[...uniqueReserves].map(Number).filter(n => !isNaN(n)));
        }
        update.reserves_tonnes = Math.round(totalReserves * 100) / 100;
      }
    }

    // Capacity (sum value_tpa for latest year)
    const capEntry = latestCapacity.get(fid);
    if (capEntry) {
      let totalCap = 0;
      for (const r of capEntry.rows) {
        const val = parseFloat(r.value_tpa);
        if (!isNaN(val)) totalCap += val;
      }
      if (totalCap > 0) {
        update.capacity_tpa = Math.round(totalCap * 100) / 100;
      }
    }

    // Ownership
    const ownEntry = latestOwnership.get(fid);
    if (ownEntry) {
      const row = ownEntry.rows[0]; // typically one row per facility per year
      if (row.owners) {
        update.owners = row.owners.split(';').map(s => s.trim()).filter(Boolean);
      }
      if (row.operators) {
        update.operators = row.operators.split(';').map(s => s.trim()).filter(Boolean);
      }
    }

    // Transport
    const transEntry = latestTransport.get(fid);
    if (transEntry) {
      const modes = new Set();
      const destinations = new Set();
      for (const r of transEntry.rows) {
        if (r.transport_by) modes.add(r.transport_by);
        if (r.export_to) destinations.add(r.export_to);
        if (r.transport_to) destinations.add(r.transport_to);
      }
      if (modes.size > 0) {
        update.transport_mode_to_port = [...modes].join(', ');
      }
      if (destinations.size > 0) {
        update.export_destination = [...destinations].filter(Boolean).join(', ');
      }
    }

    // Skip if nothing to update
    if (Object.keys(update).length === 0) continue;

    // Update in Supabase
    const { error } = await supabase
      .from('mines')
      .update(update)
      .eq('id', mine.id);

    if (error) {
      console.error(`  Error updating "${mine.name}": ${error.message}`);
      errors++;
    } else {
      enriched++;
      const fields = Object.keys(update).join(', ');
      matchDetails.push({
        mine: mine.name,
        fpName: bestFacility.facility_name,
        score: bestScore.toFixed(2),
        fields,
      });
    }
  }

  // 5. Report
  console.log('\n=== Enrichment Complete ===');
  console.log(`ICMM mines checked:     ${allMines.length}`);
  console.log(`Matched to FINEPRINT:   ${matched}`);
  console.log(`Successfully enriched:  ${enriched}`);
  console.log(`Errors:                 ${errors}`);

  if (matchDetails.length > 0) {
    console.log('\nMatch details:');
    for (const m of matchDetails) {
      console.log(`  "${m.mine}" <-> "${m.fpName}" (score: ${m.score}) — updated: ${m.fields}`);
    }
  }
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
