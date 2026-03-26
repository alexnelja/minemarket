import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createAdminSupabaseClient } from '@/lib/supabase-server';
import { estimatePrice } from '@/lib/price-engine';
import { getSubtypeByKey } from '@/lib/commodity-subtypes';
import { parseGeoPoint } from '@/lib/geo';
import type { CommodityType } from '@/lib/types';

// NOTE: This is a public calculator endpoint with no user data — no auth required.
// Rate limiting should be applied at the edge (e.g., Vercel middleware or WAF).
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const commodity = params.get('commodity') as CommodityType | null;
  const subtype = params.get('subtype');
  const gradeRaw = params.get('grade');
  const grade = gradeRaw ? parseFloat(gradeRaw) : NaN;
  const incoterm = params.get('incoterm') ?? 'FOB';
  const loadingPort = params.get('loading_port') ?? '';
  const destLat = params.get('dest_lat') ? parseFloat(params.get('dest_lat')!) : undefined;
  const destLng = params.get('dest_lng') ? parseFloat(params.get('dest_lng')!) : undefined;
  let loadingLat = params.get('loading_lat') ? parseFloat(params.get('loading_lat')!) : undefined;
  let loadingLng = params.get('loading_lng') ? parseFloat(params.get('loading_lng')!) : undefined;
  const volume = parseFloat(params.get('volume') ?? '10000');

  if (!commodity || !subtype) {
    return NextResponse.json(
      { error: 'Missing required parameters: commodity, subtype' },
      { status: 400 },
    );
  }

  const subtypeConfig = getSubtypeByKey(subtype);
  if (!subtypeConfig) {
    return NextResponse.json(
      { error: `Unknown subtype: ${subtype}` },
      { status: 400 },
    );
  }

  // Fetch latest index price from DB, falling back to hardcoded defaults
  const fallbackDefaults = getIndexDefaults(commodity, subtype);
  let indexDefaults = fallbackDefaults;
  try {
    const admin = createAdminSupabaseClient();
    const { data: priceData } = await admin
      .from('commodity_prices')
      .select('price_usd, recorded_at')
      .eq('commodity', commodity)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .single();

    if (priceData?.price_usd) {
      indexDefaults = {
        ...fallbackDefaults,
        indexPrice: priceData.price_usd,
        indexDate: priceData.recorded_at?.slice(0, 10) ?? fallbackDefaults.indexDate,
      };
    }
  } catch {
    // Fall back to hardcoded defaults
  }

  // If grade not provided, fall back to the index grade (estimate at reference quality)
  const effectiveGrade = (!isNaN(grade) && grade > 0) ? grade : indexDefaults.indexGrade;

  // If loading port name is provided but no coordinates, look up from harbours table
  if (loadingPort && (loadingLat == null || loadingLng == null)) {
    const coords = await lookupHarbourCoords(loadingPort);
    if (coords) {
      loadingLat = coords.lat;
      loadingLng = coords.lng;
    }
  }

  const estimate = estimatePrice({
    commodity,
    subtype,
    grade: effectiveGrade,
    indexGrade: indexDefaults.indexGrade,
    indexPrice: indexDefaults.indexPrice,
    indexDate: indexDefaults.indexDate,
    incoterm,
    loadingPort,
    destinationLat: destLat,
    destinationLng: destLng,
    loadingPortLat: loadingLat,
    loadingPortLng: loadingLng,
    volumeTonnes: volume,
  });

  return NextResponse.json({
    ...estimate,
    subtype: subtypeConfig.label,
    commodity: subtypeConfig.commodity,
    priceIndex: subtypeConfig.priceIndex,
    priceIndexType: subtypeConfig.priceIndexType,
  });
}

/**
 * Look up harbour coordinates by name from the harbours table.
 * Harbours have public-read RLS — no need for service-role key.
 */
async function lookupHarbourCoords(name: string): Promise<{ lat: number; lng: number } | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data } = await supabase
    .from('harbours')
    .select('location')
    .ilike('name', name)
    .limit(1)
    .single();

  if (!data?.location) return null;

  const point = parseGeoPoint(data.location);
  return point ?? null;
}

/**
 * Default index prices per commodity. In production these would come from
 * a price feed table (commodity_prices) or external API.
 */
function getIndexDefaults(commodity: CommodityType, _subtype: string): {
  indexPrice: number;
  indexGrade: number;
  indexDate: string;
} {
  // Use rough mid-2025 indicative prices
  const defaults: Record<string, { indexPrice: number; indexGrade: number; indexDate: string }> = {
    chrome: { indexPrice: 185, indexGrade: 42, indexDate: '2026-03-20' },
    manganese: { indexPrice: 5.2, indexGrade: 44, indexDate: '2026-03-20' },
    iron_ore: { indexPrice: 108, indexGrade: 62, indexDate: '2026-03-24' },
    coal: { indexPrice: 95, indexGrade: 6000, indexDate: '2026-03-21' },
    platinum: { indexPrice: 980, indexGrade: 99.95, indexDate: '2026-03-24' },
    gold: { indexPrice: 2950, indexGrade: 99.5, indexDate: '2026-03-24' },
    copper: { indexPrice: 9200, indexGrade: 99.99, indexDate: '2026-03-24' },
    vanadium: { indexPrice: 6.50, indexGrade: 98, indexDate: '2026-03-18' },
    titanium: { indexPrice: 320, indexGrade: 54, indexDate: '2026-03-15' },
    aggregates: { indexPrice: 12, indexGrade: 100, indexDate: '2026-03-01' },
  };

  return defaults[commodity] ?? { indexPrice: 100, indexGrade: 100, indexDate: '2026-03-01' };
}
