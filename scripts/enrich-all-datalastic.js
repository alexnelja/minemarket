#!/usr/bin/env node
/**
 * Master script: runs all Datalastic enrichment in optimal order.
 * Designed for one-month subscription extraction.
 *
 * Usage:
 *   DATALASTIC_API_KEY=your_key node scripts/enrich-all-datalastic.js
 *   DATALASTIC_API_KEY=your_key node scripts/enrich-all-datalastic.js --dry-run
 *
 * Credit budget (Starter plan: 20,000):
 *   Step 1: Vessel enrichment    ~10,500 credits (10,500 vessels)
 *   Step 2: Port enrichment      ~35 credits (35 ports)
 *   Total:                       ~10,535 credits
 *   Remaining:                   ~9,465 credits for ad-hoc lookups
 */

const { execSync } = require('child_process');

const DATALASTIC_API_KEY = process.env.DATALASTIC_API_KEY;
const DRY_RUN = process.argv.includes('--dry-run');

if (!DATALASTIC_API_KEY) {
  console.error('ERROR: Set DATALASTIC_API_KEY environment variable');
  console.error('  DATALASTIC_API_KEY=your_key node scripts/enrich-all-datalastic.js');
  process.exit(1);
}

console.log('╔══════════════════════════════════════════════════╗');
console.log('║  Datalastic Full Enrichment — One-Time Extract   ║');
console.log('╠══════════════════════════════════════════════════╣');
console.log('║  Budget: 20,000 credits (Starter plan)           ║');
console.log('║  Step 1: Vessels (~10,500 credits)                ║');
console.log('║  Step 2: Ports (~35 credits)                      ║');
console.log('║  Remaining: ~9,465 for future use                 ║');
console.log('╚══════════════════════════════════════════════════╝');
console.log();

const env = { ...process.env, DATALASTIC_API_KEY };
const dryFlag = DRY_RUN ? ' --dry-run' : '';

try {
  console.log('=== STEP 1: Vessel Enrichment ===\n');
  execSync(`node scripts/enrich-vessels-datalastic.js${dryFlag}`, { env, stdio: 'inherit' });

  console.log('\n=== STEP 2: Port Enrichment ===\n');
  execSync(`node scripts/enrich-ports-datalastic.js`, { env, stdio: 'inherit' });

  console.log('\n════════════════════════════════');
  console.log('  All enrichment complete!');
  console.log('  Your data is now stored locally.');
  console.log('  You can cancel Datalastic after this month.');
  console.log('  AIS stream will keep vessel positions fresh for free.');
  console.log('════════════════════════════════');
} catch (err) {
  console.error('Enrichment failed:', err.message);
  process.exit(1);
}
