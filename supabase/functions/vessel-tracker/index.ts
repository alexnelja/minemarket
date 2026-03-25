import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const AIS_API_KEY = Deno.env.get("AISSTREAM_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Bounding boxes for key bulk mineral shipping regions
const BOUNDING_BOXES = [
  [[-35, 15], [-25, 35]],     // South Africa coast
  [[0, 95], [45, 145]],       // East Asia (China, Japan, Korea)
  [[0, 65], [25, 85]],        // India
  [[-40, 110], [-10, 160]],   // Australia
  [[30, -15], [60, 30]],      // Europe
  [[-35, -55], [5, -30]],     // Brazil
];

Deno.serve(async (_req) => {
  // This function is triggered by a cron job (every 5 minutes)
  // It connects to aisstream.io, collects positions for 60 seconds, then updates the DB

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (!AIS_API_KEY) {
    return new Response(JSON.stringify({ error: "AISSTREAM_API_KEY not set" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const vessels = new Map<string, Record<string, unknown>>();

    // Connect to AIS stream
    const ws = new WebSocket("wss://stream.aisstream.io/v0/stream");

    const connectionPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.log("WebSocket timeout, closing...");
        ws.close();
        resolve();
      }, 45000); // 45 second safety timeout

      ws.onopen = () => {
        console.log("WebSocket connected, sending subscription...");
        ws.send(JSON.stringify({
          APIKey: AIS_API_KEY,
          BoundingBoxes: BOUNDING_BOXES,
          FilterMessageTypes: ["PositionReport", "ShipStaticData"],
        }));
        console.log("Subscription sent, collecting for 30s...");
      };

      ws.onmessage = (event) => {
        try {
          const raw = typeof event.data === "string" ? event.data : "";
          if (!raw) return;
          const data = JSON.parse(raw);
          const meta = data.MetaData;
          if (!meta?.MMSI) return;

          const mmsi = String(meta.MMSI);
          const existing = vessels.get(mmsi) || {};

          if (data.MessageType === "PositionReport") {
            const pos = data.Message?.PositionReport;
            if (pos) {
              vessels.set(mmsi, {
                ...existing,
                mmsi,
                name: meta.ShipName?.trim() || existing.name || "Unknown",
                lat: pos.Latitude,
                lng: pos.Longitude,
                speed: pos.Sog,
                course: pos.Cog,
                heading: pos.TrueHeading,
                ship_type: meta.ShipType || existing.ship_type,
                last_seen: new Date().toISOString(),
              });
            }
          } else if (data.MessageType === "ShipStaticData") {
            const sd = data.Message?.ShipStaticData;
            if (sd) {
              vessels.set(mmsi, {
                ...existing,
                mmsi,
                name: meta.ShipName?.trim() || existing.name,
                destination: sd.Destination?.trim() || existing.destination,
                eta: sd.Eta
                  ? `${sd.Eta.Month}/${sd.Eta.Day} ${sd.Eta.Hour}:${sd.Eta.Minute}`
                  : existing.eta,
                ship_type: sd.Type || existing.ship_type,
              });
            }
          }
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        reject(new Error("WebSocket error"));
      };

      // Collect for 30 seconds then close
      setTimeout(() => {
        console.log(`Collected ${vessels.size} vessels, closing WebSocket...`);
        clearTimeout(timeout);
        ws.close();
        resolve();
      }, 30000);

      ws.onclose = () => {
        clearTimeout(timeout);
        resolve();
      };
    });

    await connectionPromise;

    // Batch upsert vessel positions
    const vesselArray = Array.from(vessels.values()).filter(
      (v) => v.lat && v.lng
    );
    let upserted = 0;

    for (let i = 0; i < vesselArray.length; i += 500) {
      const batch = vesselArray.slice(i, i + 500);
      const { error } = await supabase
        .from("vessel_positions")
        .upsert(batch, { onConflict: "mmsi" });
      if (!error) upserted += batch.length;
    }

    // Clean up old positions (> 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await supabase
      .from("vessel_positions")
      .delete()
      .lt("last_seen", oneDayAgo);

    return new Response(
      JSON.stringify({
        message: `Collected ${vesselArray.length} vessels, upserted ${upserted}`,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
