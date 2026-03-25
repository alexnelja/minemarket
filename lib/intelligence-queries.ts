// lib/intelligence-queries.ts

import { createAdminSupabaseClient } from './supabase-server';
import type { CommodityType } from './types';
import { COMMODITY_CONFIG } from './types';

// --- Volume Flow ---

export interface VolumeFlowRow {
  commodity: CommodityType;
  label: string;
  color: string;
  dealCount: number;
  totalVolume: number;
  totalValue: number;
}

export async function getVolumeFlow(): Promise<VolumeFlowRow[]> {
  const admin = createAdminSupabaseClient();
  const { data: deals } = await admin
    .from('deals')
    .select('commodity_type, volume_tonnes, agreed_price, status')
    .in('status', ['completed', 'escrow_released', 'delivered', 'in_transit', 'loading', 'escrow_held']);

  if (!deals || deals.length === 0) return [];

  const byCommodity = new Map<CommodityType, { count: number; volume: number; value: number }>();

  for (const d of deals) {
    const ct = d.commodity_type as CommodityType;
    const existing = byCommodity.get(ct) ?? { count: 0, volume: 0, value: 0 };
    existing.count += 1;
    existing.volume += d.volume_tonnes as number;
    existing.value += (d.volume_tonnes as number) * (d.agreed_price as number);
    byCommodity.set(ct, existing);
  }

  return Array.from(byCommodity.entries()).map(([commodity, stats]) => ({
    commodity,
    label: COMMODITY_CONFIG[commodity].label,
    color: COMMODITY_CONFIG[commodity].color,
    dealCount: stats.count,
    totalVolume: stats.volume,
    totalValue: stats.value,
  })).sort((a, b) => b.totalVolume - a.totalVolume);
}

// --- Supply Intelligence ---

export interface SupplyRow {
  mineId: string;
  mineName: string;
  region: string;
  listingCount: number;
  totalVolume: number;
  commodities: CommodityType[];
}

export async function getSupplyIntelligence(): Promise<SupplyRow[]> {
  const admin = createAdminSupabaseClient();
  const { data: listings } = await admin
    .from('listings')
    .select(`
      id, volume_tonnes, commodity_type, created_at,
      mines!source_mine_id (id, name, region)
    `);

  if (!listings || listings.length === 0) return [];

  const byMine = new Map<string, SupplyRow>();

  for (const l of listings) {
    const mine = l.mines as unknown as Record<string, unknown> | null;
    if (!mine) continue;
    const mineId = mine.id as string;
    const existing = byMine.get(mineId) ?? {
      mineId,
      mineName: (mine.name as string) ?? 'Unknown',
      region: (mine.region as string) ?? 'Unknown',
      listingCount: 0,
      totalVolume: 0,
      commodities: [],
    };
    existing.listingCount += 1;
    existing.totalVolume += l.volume_tonnes as number;
    const ct = l.commodity_type as CommodityType;
    if (!existing.commodities.includes(ct)) {
      existing.commodities.push(ct);
    }
    byMine.set(mineId, existing);
  }

  return Array.from(byMine.values()).sort((a, b) => b.totalVolume - a.totalVolume);
}

// --- Demand Heatmap ---

export interface DemandRow {
  commodity: CommodityType;
  label: string;
  color: string;
  deliveryPort: string;
  requirementCount: number;
  totalVolumeNeeded: number;
  avgTargetPrice: number;
}

export async function getDemandIntelligence(): Promise<DemandRow[]> {
  const admin = createAdminSupabaseClient();
  const { data: requirements } = await admin
    .from('requirements')
    .select('commodity_type, delivery_port, volume_needed, target_price, status')
    .eq('status', 'active');

  if (!requirements || requirements.length === 0) return [];

  const byKey = new Map<string, DemandRow>();

  for (const r of requirements) {
    const ct = r.commodity_type as CommodityType;
    const port = (r.delivery_port as string) ?? 'Unknown';
    const key = `${ct}::${port}`;
    const existing = byKey.get(key) ?? {
      commodity: ct,
      label: COMMODITY_CONFIG[ct].label,
      color: COMMODITY_CONFIG[ct].color,
      deliveryPort: port,
      requirementCount: 0,
      totalVolumeNeeded: 0,
      avgTargetPrice: 0,
    };
    existing.requirementCount += 1;
    existing.totalVolumeNeeded += r.volume_needed as number;
    // Running sum for average computation
    existing.avgTargetPrice += r.target_price as number;
    byKey.set(key, existing);
  }

  // Finalize averages
  return Array.from(byKey.values())
    .map((row) => ({
      ...row,
      avgTargetPrice: row.requirementCount > 0
        ? Math.round(row.avgTargetPrice / row.requirementCount)
        : 0,
    }))
    .sort((a, b) => b.totalVolumeNeeded - a.totalVolumeNeeded);
}

// --- Market Concentration ---

export interface ConcentrationRow {
  sellerId: string;
  sellerName: string;
  dealCount: number;
  totalVolume: number;
  volumeShare: number; // percentage
}

export async function getMarketConcentration(): Promise<ConcentrationRow[]> {
  const admin = createAdminSupabaseClient();
  const { data: deals } = await admin
    .from('deals')
    .select('seller_id, volume_tonnes, status')
    .in('status', ['completed', 'escrow_released', 'delivered', 'in_transit', 'loading', 'escrow_held']);

  if (!deals || deals.length === 0) return [];

  const bySeller = new Map<string, { count: number; volume: number }>();
  let grandTotal = 0;

  for (const d of deals) {
    const sellerId = d.seller_id as string;
    const volume = d.volume_tonnes as number;
    grandTotal += volume;
    const existing = bySeller.get(sellerId) ?? { count: 0, volume: 0 };
    existing.count += 1;
    existing.volume += volume;
    bySeller.set(sellerId, existing);
  }

  // Fetch seller names
  const sellerIds = [...bySeller.keys()];
  const { data: users } = await admin
    .from('users')
    .select('id, company_name')
    .in('id', sellerIds);

  const nameMap = new Map((users ?? []).map((u: { id: string; company_name: string }) => [u.id, u.company_name]));

  return Array.from(bySeller.entries())
    .map(([sellerId, stats]) => ({
      sellerId,
      sellerName: nameMap.get(sellerId) ?? 'Unknown',
      dealCount: stats.count,
      totalVolume: stats.volume,
      volumeShare: grandTotal > 0 ? Math.round((stats.volume / grandTotal) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.totalVolume - a.totalVolume)
    .slice(0, 10); // Top 10
}

// --- Deal Velocity ---

export interface VelocityStage {
  from: string;
  to: string;
  label: string;
  avgDays: number;
  dealCount: number;
}

export async function getDealVelocity(): Promise<VelocityStage[]> {
  const admin = createAdminSupabaseClient();

  // Fetch completed deals with their milestones to compute stage durations
  const { data: deals } = await admin
    .from('deals')
    .select('id, created_at, second_accept_at, status')
    .in('status', ['completed', 'escrow_released']);

  if (!deals || deals.length === 0) return [];

  const dealIds = deals.map((d) => d.id as string);
  const { data: milestones } = await admin
    .from('deal_milestones')
    .select('deal_id, milestone_type, timestamp')
    .in('deal_id', dealIds)
    .order('timestamp', { ascending: true });

  // Build a timeline per deal
  const dealTimelines = new Map<string, Map<string, string>>();
  for (const d of deals) {
    const timeline = new Map<string, string>();
    timeline.set('created', d.created_at as string);
    if (d.second_accept_at) {
      timeline.set('second_accept', d.second_accept_at as string);
    }
    dealTimelines.set(d.id as string, timeline);
  }

  for (const m of (milestones ?? [])) {
    const timeline = dealTimelines.get(m.deal_id as string);
    if (timeline) {
      timeline.set(m.milestone_type as string, m.timestamp as string);
    }
  }

  // Compute average duration between stages
  const stages: { from: string; to: string; label: string }[] = [
    { from: 'created', to: 'second_accept', label: 'Interest to Agreement' },
    { from: 'second_accept', to: 'loaded', label: 'Agreement to Loading' },
    { from: 'loaded', to: 'departed_port', label: 'Loading to Departure' },
    { from: 'departed_port', to: 'delivered', label: 'Departure to Delivery' },
  ];

  return stages.map(({ from, to, label }) => {
    const durations: number[] = [];
    for (const timeline of dealTimelines.values()) {
      const fromTs = timeline.get(from);
      const toTs = timeline.get(to);
      if (fromTs && toTs) {
        const days = (new Date(toTs).getTime() - new Date(fromTs).getTime()) / (1000 * 60 * 60 * 24);
        if (days >= 0) durations.push(days);
      }
    }
    const avgDays = durations.length > 0
      ? Math.round((durations.reduce((s, d) => s + d, 0) / durations.length) * 10) / 10
      : 0;
    return { from, to, label, avgDays, dealCount: durations.length };
  });
}

// --- Verification Insights ---
// Spec accuracy trends: listed spec vs lab-tested actual values per mine

export interface VerificationInsightRow {
  mineName: string;
  commodity: string;
  listingsCount: number;
  verificationsCount: number;
  verificationRate: number; // 0-1
  avgSpecDeviation: number; // average % deviation between listed and actual
}

export async function getVerificationInsights(): Promise<VerificationInsightRow[]> {
  const admin = createAdminSupabaseClient();

  // Fetch all verifications joined with listings and mines
  const { data: verifications } = await admin
    .from('verifications')
    .select(`
      assay_results,
      listings!listing_id (
        commodity_type, spec_sheet,
        mines!source_mine_id (name)
      )
    `);

  if (!verifications || verifications.length === 0) return [];

  // Group by mine
  const byMine = new Map<string, {
    commodity: string;
    listings: number;
    verifications: number;
    deviations: number[];
  }>();

  for (const v of verifications) {
    const listing = v.listings as unknown as Record<string, unknown> | null;
    if (!listing) continue;
    const mine = listing.mines as unknown as Record<string, unknown> | null;
    const mineName = (mine?.name as string) ?? 'Unknown';
    const commodity = (listing.commodity_type as string) ?? 'unknown';
    const specSheet = (listing.spec_sheet ?? {}) as Record<string, number>;
    const assay = (v.assay_results ?? {}) as Record<string, number>;

    const existing = byMine.get(mineName) ?? {
      commodity,
      listings: 0,
      verifications: 0,
      deviations: [],
    };
    existing.verifications += 1;

    // Calculate spec deviation for overlapping keys
    for (const key of Object.keys(assay)) {
      if (specSheet[key] !== undefined && specSheet[key] > 0) {
        const deviation = Math.abs(assay[key] - specSheet[key]) / specSheet[key];
        existing.deviations.push(deviation);
      }
    }

    byMine.set(mineName, existing);
  }

  // Count total listings per mine
  const { data: listings } = await admin
    .from('listings')
    .select('mines!source_mine_id (name)');

  if (listings) {
    for (const l of listings) {
      const mine = l.mines as unknown as Record<string, unknown> | null;
      const mineName = (mine?.name as string) ?? 'Unknown';
      const existing = byMine.get(mineName);
      if (existing) existing.listings += 1;
    }
  }

  return Array.from(byMine.entries()).map(([mineName, stats]) => ({
    mineName,
    commodity: stats.commodity,
    listingsCount: stats.listings,
    verificationsCount: stats.verifications,
    verificationRate: stats.listings > 0 ? stats.verifications / stats.listings : 0,
    avgSpecDeviation: stats.deviations.length > 0
      ? stats.deviations.reduce((s, d) => s + d, 0) / stats.deviations.length * 100
      : 0,
  }));
}
