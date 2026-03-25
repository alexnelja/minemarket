import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase-server';

// AIS bounding boxes for key bulk mineral shipping regions
const BOUNDING_BOXES = [
  [[-35, 15], [-25, 35]],     // South Africa coast
  [[0, 95], [45, 145]],       // East Asia (China, Japan, Korea)
  [[0, 65], [25, 85]],        // India
  [[-40, 110], [-10, 160]],   // Australia
  [[30, -15], [60, 30]],      // Europe
  [[-35, -55], [5, -30]],     // Brazil
];

// Key ports for congestion calculation
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

const RADIUS = 0.2; // ~22km bounding box

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sets CRON_SECRET automatically)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const AIS_API_KEY = process.env.AISSTREAM_API_KEY;
  if (!AIS_API_KEY) {
    return NextResponse.json({ error: 'AISSTREAM_API_KEY not set' }, { status: 500 });
  }

  const admin = createAdminSupabaseClient();

  try {
    // --- Step 1: Collect AIS data for 25 seconds ---
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
                eta: sd.Eta ? `${sd.Eta.Month}/${sd.Eta.Day} ${sd.Eta.Hour}:${sd.Eta.Minute}` : existing.eta || null,
                ship_type: sd.Type || existing.ship_type || 0,
              });
            }
          }
        } catch { /* ignore malformed */ }
      });

      ws.on('error', () => resolve());

      setTimeout(() => {
        ws.close();
        resolve();
      }, 25000);

      ws.on('close', () => resolve());
    });

    // --- Step 2: Upsert vessels ---
    const vesselArray = Array.from(vessels.values()).filter(v => v.lat && v.lng);
    let upserted = 0;

    for (let i = 0; i < vesselArray.length; i += 500) {
      const batch = vesselArray.slice(i, i + 500);
      const { error } = await admin
        .from('vessel_positions')
        .upsert(batch, { onConflict: 'mmsi' });
      if (!error) upserted += batch.length;
    }

    // Clean stale (>24h)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await admin.from('vessel_positions').delete().lt('last_seen', oneDayAgo);

    // --- Step 3: Calculate port congestion ---
    const allVessels = vesselArray.length > 0 ? vesselArray : [];
    // Also fetch existing vessels if we got few new ones
    if (allVessels.length < 100) {
      const { data: dbVessels } = await admin.from('vessel_positions').select('lat, lng, speed');
      if (dbVessels) allVessels.push(...dbVessels.map(v => ({ ...v })));
    }

    // Look up harbour IDs
    const portCongestion = [];
    for (const port of KEY_PORTS) {
      const { data: harbours } = await admin
        .from('harbours')
        .select('id')
        .ilike('name', `%${port.name}%`)
        .limit(1);

      const harbourId = harbours?.[0]?.id;
      if (!harbourId) continue;

      // Count vessels near this port
      const nearby = allVessels.filter(v => {
        const lat = v.lat as number;
        const lng = v.lng as number;
        return Math.abs(lat - port.lat) < RADIUS && Math.abs(lng - port.lng) < RADIUS;
      });

      const atPort = nearby.filter(v => (v.speed as number) < 0.5).length;
      const anchored = nearby.filter(v => (v.speed as number) >= 0.5 && (v.speed as number) < 3).length;
      const approaching = nearby.filter(v => (v.speed as number) >= 3 && (v.speed as number) < 8).length;
      const total = nearby.length;

      const congestionLevel = total >= 15 ? 'high' : total >= 5 ? 'medium' : 'low';

      portCongestion.push({
        harbour_id: harbourId,
        vessels_at_port: total,
        vessels_anchored: anchored,
        vessels_approaching: approaching,
        congestion_level: congestionLevel,
        last_calculated: new Date().toISOString(),
        source: 'aisstream',
      });
    }

    if (portCongestion.length > 0) {
      await admin.from('port_congestion').upsert(portCongestion, { onConflict: 'harbour_id' });
    }

    return NextResponse.json({
      vessels_collected: vesselArray.length,
      vessels_upserted: upserted,
      ports_updated: portCongestion.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
