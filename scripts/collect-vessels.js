#!/usr/bin/env node
/**
 * Collects live AIS vessel positions from aisstream.io and stores in Supabase.
 * Run: node scripts/collect-vessels.js
 * Duration: 30 seconds by default, or pass --duration=60 for 60s
 */

const WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');

const AIS_API_KEY = '8eac2f14c28e8efb19f8ddbec86fd11b632ebe49';
const SUPABASE_URL = 'https://eawfhchyytnsewgnbznm.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhd2ZoY2h5eXRuc2V3Z25iem5tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzk5NjQ2OSwiZXhwIjoyMDg5NTcyNDY5fQ.57kJ6h03C6bm_z2kHuWazvZ88yiJNsU-qqsd6CF1iP0';

const DURATION = parseInt(process.argv.find(a => a.startsWith('--duration='))?.split('=')[1] || '30') * 1000;

// AIS ship type name lookup
const AIS_SHIP_TYPES = {
  70: 'Cargo', 71: 'Cargo (DG)', 72: 'Cargo (DG)', 73: 'Cargo (DG)', 74: 'Cargo (DG)',
  75: 'Cargo', 76: 'Cargo', 77: 'Cargo', 78: 'Cargo', 79: 'Cargo',
  80: 'Tanker', 81: 'Tanker (DG)', 82: 'Tanker (DG)', 83: 'Tanker (DG)', 84: 'Tanker (DG)',
  85: 'Tanker', 86: 'Tanker', 87: 'Tanker', 88: 'Tanker', 89: 'Tanker',
  90: 'Other', 91: 'Tug', 92: 'Tug', 93: 'Port Tender',
};

// Bounding boxes for key bulk mineral shipping regions
const BOUNDING_BOXES = [
  [[-35, 15], [-25, 35]],     // South Africa coast
  [[0, 95], [45, 145]],       // East Asia (China, Japan, Korea)
  [[0, 65], [25, 85]],        // India
  [[-40, 110], [-10, 160]],   // Australia
  [[30, -15], [60, 30]],      // Europe
  [[-35, -55], [5, -30]],     // Brazil
];

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const vessels = new Map();
  console.log(`Connecting to aisstream.io (collecting for ${DURATION/1000}s)...`);

  const ws = new WebSocket('wss://stream.aisstream.io/v0/stream');

  await new Promise((resolve, reject) => {
    ws.on('open', () => {
      console.log('Connected. Sending subscription for 6 bounding boxes...');
      ws.send(JSON.stringify({
        APIKey: AIS_API_KEY,
        BoundingBoxes: BOUNDING_BOXES,
        FilterMessageTypes: ['PositionReport', 'ShipStaticData'],
      }));
    });

    ws.on('message', (raw) => {
      try {
        const data = JSON.parse(raw.toString());
        const meta = data.MetaData;
        if (!meta?.MMSI) return;

        const mmsi = String(meta.MMSI);
        const existing = vessels.get(mmsi) || {};

        if (data.MessageType === 'PositionReport') {
          const pos = data.Message?.PositionReport;
          if (pos) {
            vessels.set(mmsi, {
              ...existing,
              mmsi,
              name: (meta.ShipName || '').trim() || existing.name || 'Unknown',
              lat: pos.Latitude,
              lng: pos.Longitude,
              speed: pos.Sog,
              course: pos.Cog,
              heading: pos.TrueHeading,
              ship_type: meta.ShipType || existing.ship_type || 0,
              last_seen: new Date().toISOString(),
              source: 'aisstream',
            });
          }
        } else if (data.MessageType === 'ShipStaticData') {
          const sd = data.Message?.ShipStaticData;
          if (sd) {
            vessels.set(mmsi, {
              ...existing,
              mmsi,
              name: (meta.ShipName || '').trim() || existing.name,
              destination: (sd.Destination || '').trim() || existing.destination || null,
              eta: sd.Eta
                ? `${sd.Eta.Month}/${sd.Eta.Day} ${sd.Eta.Hour}:${sd.Eta.Minute}`
                : existing.eta || null,
              ship_type: sd.Type || existing.ship_type || 0,
              imo: sd.ImoNumber ? String(sd.ImoNumber) : existing.imo || null,
              vessel_type_name: sd.Type ? AIS_SHIP_TYPES[sd.Type] || null : existing.vessel_type_name || null,
              length: sd.Dimension?.A && sd.Dimension?.B ? sd.Dimension.A + sd.Dimension.B : existing.length || null,
              width: sd.Dimension?.C && sd.Dimension?.D ? sd.Dimension.C + sd.Dimension.D : existing.width || null,
              draught: sd.MaximumStaticDraught || existing.draught || null,
            });
          }
        }

        // Progress
        if (vessels.size % 100 === 0 && vessels.size > 0) {
          process.stdout.write(`\r  Vessels: ${vessels.size}`);
        }
      } catch {}
    });

    ws.on('error', (err) => {
      console.error('WebSocket error:', err.message);
      reject(err);
    });

    setTimeout(() => {
      ws.close();
      resolve();
    }, DURATION);
  });

  console.log(`\nCollection done. ${vessels.size} unique vessels.`);

  // Batch upsert
  const vesselArray = Array.from(vessels.values()).filter(v => v.lat && v.lng);
  console.log(`Upserting ${vesselArray.length} vessels with valid positions...`);

  let upserted = 0;
  let errors = 0;
  for (let i = 0; i < vesselArray.length; i += 500) {
    const batch = vesselArray.slice(i, i + 500);
    const { error } = await supabase
      .from('vessel_positions')
      .upsert(batch, { onConflict: 'mmsi' });
    if (error) {
      console.error(`  Batch ${i}-${i+batch.length} error:`, error.message);
      errors++;
    } else {
      upserted += batch.length;
    }
  }

  // Clean stale (>24h)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  await supabase.from('vessel_positions').delete().lt('last_seen', oneDayAgo);

  console.log(`\nDone: ${upserted} upserted, ${errors} batch errors`);

  // Stats
  const { count } = await supabase.from('vessel_positions').select('mmsi', { count: 'exact', head: true });
  console.log(`Total vessels in DB: ${count}`);

  // Sample
  const { data: sample } = await supabase
    .from('vessel_positions')
    .select('mmsi, name, lat, lng, speed, destination')
    .order('last_seen', { ascending: false })
    .limit(5);
  console.log('\nLatest vessels:');
  sample?.forEach(v => console.log(`  ${v.name?.padEnd(25)} MMSI:${v.mmsi} [${v.lat?.toFixed(2)}, ${v.lng?.toFixed(2)}] ${v.speed}kn → ${v.destination || '?'}`));
}

main().catch(console.error);
