import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase-server';

/**
 * Unified daily cron job — runs once per day at 06:00 UTC
 * Combines: AIS vessel collection, port congestion, commodity prices
 */

// AIS ship type name lookup
const AIS_SHIP_TYPES: Record<number, string> = {
  70: 'Cargo', 71: 'Cargo (DG)', 72: 'Cargo (DG)', 73: 'Cargo (DG)', 74: 'Cargo (DG)',
  75: 'Cargo', 76: 'Cargo', 77: 'Cargo', 78: 'Cargo', 79: 'Cargo',
  80: 'Tanker', 81: 'Tanker (DG)', 82: 'Tanker (DG)', 83: 'Tanker (DG)', 84: 'Tanker (DG)',
  85: 'Tanker', 86: 'Tanker', 87: 'Tanker', 88: 'Tanker', 89: 'Tanker',
  90: 'Other', 91: 'Tug', 92: 'Tug', 93: 'Port Tender',
};

// AIS bounding boxes
const BOUNDING_BOXES = [
  [[-35, 15], [-25, 35]],     // South Africa
  [[0, 95], [45, 145]],       // East Asia
  [[0, 65], [25, 85]],        // India
  [[-40, 110], [-10, 160]],   // Australia
  [[30, -15], [60, 30]],      // Europe
  [[-35, -55], [5, -30]],     // Brazil
];

const KEY_PORTS = [
  { name: 'Richards Bay', lat: -28.801, lng: 32.038 },
  { name: 'Saldanha Bay', lat: -33.004, lng: 17.938 },
  { name: 'Durban', lat: -29.868, lng: 31.048 },
  { name: 'Port Elizabeth', lat: -33.768, lng: 25.629 },
  { name: 'Maputo', lat: -25.969, lng: 32.573 },
  { name: 'Qingdao', lat: 36.067, lng: 120.383 },
  { name: 'Rotterdam', lat: 51.953, lng: 4.133 },
  { name: 'Mumbai', lat: 18.940, lng: 72.840 },
  { name: 'Singapore', lat: 1.264, lng: 103.822 },
  { name: 'Shanghai', lat: 31.230, lng: 121.474 },
];

const RADIUS = 0.2;

export const maxDuration = 60; // Allow up to 60s execution

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminSupabaseClient();
  const results: Record<string, unknown> = { timestamp: new Date().toISOString() };

  // === 1. COLLECT AIS VESSELS ===
  const AIS_API_KEY = process.env.AISSTREAM_API_KEY;
  if (AIS_API_KEY) {
    try {
      const vessels = new Map<string, Record<string, unknown>>();
      const wsModule = await import('ws');
      const WebSocket = wsModule.default;
      const ws = new WebSocket('wss://stream.aisstream.io/v0/stream');

      await new Promise<void>((resolve) => {
        ws.on('open', () => {
          ws.send(JSON.stringify({
            APIKey: AIS_API_KEY,
            BoundingBoxes: BOUNDING_BOXES,
            FilterMessageTypes: ['PositionReport', 'ShipStaticData'],
          }));
        });

        ws.on('message', (raw: Buffer) => {
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
                  ...existing, mmsi,
                  name: (meta.ShipName || '').trim() || existing.name || 'Unknown',
                  lat: pos.Latitude, lng: pos.Longitude,
                  speed: pos.Sog, course: pos.Cog, heading: pos.TrueHeading,
                  ship_type: meta.ShipType || existing.ship_type || 0,
                  last_seen: new Date().toISOString(), source: 'aisstream',
                });
              }
            } else if (data.MessageType === 'ShipStaticData') {
              const sd = data.Message?.ShipStaticData;
              if (sd) {
                vessels.set(mmsi, {
                  ...existing, mmsi,
                  name: (meta.ShipName || '').trim() || existing.name,
                  destination: (sd.Destination || '').trim() || existing.destination || null,
                  eta: sd.Eta ? `${sd.Eta.Month}/${sd.Eta.Day} ${sd.Eta.Hour}:${sd.Eta.Minute}` : existing.eta || null,
                  ship_type: sd.Type || existing.ship_type || 0,
                  imo: sd.ImoNumber ? String(sd.ImoNumber) : existing.imo || null,
                  vessel_type_name: sd.Type ? AIS_SHIP_TYPES[sd.Type as number] || null : existing.vessel_type_name || null,
                  length: sd.Dimension?.A && sd.Dimension?.B ? sd.Dimension.A + sd.Dimension.B : existing.length || null,
                  width: sd.Dimension?.C && sd.Dimension?.D ? sd.Dimension.C + sd.Dimension.D : existing.width || null,
                  draught: sd.MaximumStaticDraught || existing.draught || null,
                });
              }
            }
          } catch { /* ignore */ }
        });

        ws.on('error', () => resolve());
        setTimeout(() => { ws.close(); resolve(); }, 50000);
        ws.on('close', () => resolve());
      });

      const vesselArray = Array.from(vessels.values()).filter(v => v.lat && v.lng);
      let upserted = 0;
      for (let i = 0; i < vesselArray.length; i += 500) {
        const batch = vesselArray.slice(i, i + 500);
        const { error } = await admin.from('vessel_positions').upsert(batch, { onConflict: 'mmsi' });
        if (!error) upserted += batch.length;
      }

      // Clean stale
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      await admin.from('vessel_positions').delete().lt('last_seen', oneDayAgo);

      results.vessels = { collected: vesselArray.length, upserted };

      // === 2. CALCULATE PORT CONGESTION ===
      const allVessels = vesselArray.length > 100 ? vesselArray :
        (await admin.from('vessel_positions').select('lat, lng, speed')).data?.map(v => ({ ...v })) || [];

      const congestionRecords = [];
      for (const port of KEY_PORTS) {
        const { data: harbours } = await admin.from('harbours').select('id').ilike('name', `%${port.name}%`).limit(1);
        if (!harbours?.[0]?.id) continue;

        const nearby = allVessels.filter(v =>
          Math.abs((v.lat as number) - port.lat) < RADIUS &&
          Math.abs((v.lng as number) - port.lng) < RADIUS
        );

        congestionRecords.push({
          harbour_id: harbours[0].id,
          vessels_at_port: nearby.length,
          vessels_anchored: nearby.filter(v => (v.speed as number) >= 0.5 && (v.speed as number) < 3).length,
          vessels_approaching: nearby.filter(v => (v.speed as number) >= 3 && (v.speed as number) < 8).length,
          congestion_level: nearby.length >= 15 ? 'high' : nearby.length >= 5 ? 'medium' : 'low',
          last_calculated: new Date().toISOString(),
          source: 'aisstream',
        });
      }

      if (congestionRecords.length > 0) {
        await admin.from('port_congestion').upsert(congestionRecords, { onConflict: 'harbour_id' });
      }
      results.congestion = { ports_updated: congestionRecords.length };

    } catch (err) {
      results.vessels = { error: String(err) };
    }
  } else {
    results.vessels = { skipped: 'AISSTREAM_API_KEY not set' };
  }

  // === 3. REFRESH COMMODITY PRICES ===
  try {
    // Fetch World Bank Pink Sheet for iron ore + coal
    const wbRes = await fetch('https://thedocs.worldbank.org/en/doc/5d903e848db1d1b83e0ec8f744e55570-0350012021/related/CMO-Historical-Data-Monthly.xlsx');
    if (wbRes.ok) {
      // We can't parse XLSX in the edge runtime easily without the xlsx package
      // So just update the "last refreshed" timestamp and rely on the local ingest script for actual data
      results.prices = { note: 'World Bank data available — run npm run ingest:prices locally for full update' };
    }

    // Update platform-derived prices from recent deals
    const commodities = ['chrome', 'manganese', 'iron_ore', 'coal', 'platinum', 'gold', 'copper', 'vanadium', 'titanium', 'aggregates'];
    let pricesUpdated = 0;

    for (const commodity of commodities) {
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const { data: deals } = await admin
        .from('deals')
        .select('agreed_price')
        .eq('commodity_type', commodity)
        .in('status', ['completed', 'escrow_released'])
        .gte('created_at', ninetyDaysAgo);

      if (deals && deals.length > 0) {
        const avg = deals.reduce((s, d) => s + (d.agreed_price as number), 0) / deals.length;
        await admin.from('commodity_prices').upsert({
          commodity,
          price_usd: Math.round(avg * 100) / 100,
          unit: 'per_tonne',
          source: 'platform_avg',
          period: new Date().toISOString().slice(0, 7),
          recorded_at: new Date().toISOString(),
        }, { onConflict: 'commodity,source,period' });
        pricesUpdated++;
      }
    }

    results.prices = { ...(results.prices as Record<string, unknown> || {}), platform_prices_updated: pricesUpdated };
  } catch (err) {
    results.prices = { error: String(err) };
  }

  return NextResponse.json(results);
}
