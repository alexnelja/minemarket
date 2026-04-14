import { createServerSupabaseClient, createAdminSupabaseClient } from './supabase-server';
import type {
  Deal, DealMilestone, DealDocument, Rating, CommodityType,
} from './types';
import { PAGINATION } from './constants';

// Extended deal with joined counterparty and listing info
export interface DealWithDetails extends Deal {
  counterparty_name: string;
  mine_name: string;
  harbour_name: string;
}

export async function getDealsByUser(userId: string): Promise<DealWithDetails[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('deals')
    .select(`
      *,
      listings!listing_id (
        commodity_type,
        mines!source_mine_id (name),
        harbours!loading_port_id (name)
      )
    `)
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  // Fetch counterparty names using admin client (bypasses RLS on users table)
  const counterpartyIds = data.map((d: Record<string, unknown>) =>
    d.buyer_id === userId ? d.seller_id : d.buyer_id
  ) as string[];
  const uniqueIds = [...new Set(counterpartyIds)];

  const admin = createAdminSupabaseClient();
  const { data: users } = await admin
    .from('users')
    .select('id, company_name')
    .in('id', uniqueIds);

  const userMap = new Map((users ?? []).map((u: { id: string; company_name: string }) => [u.id, u.company_name]));

  return data.map((d: Record<string, unknown>) => {
    const listing = d.listings as Record<string, unknown> | null;
    const mine = listing?.mines as Record<string, unknown> | null;
    const harbour = listing?.harbours as Record<string, unknown> | null;
    const counterpartyId = (d.buyer_id === userId ? d.seller_id : d.buyer_id) as string;

    return {
      ...d,
      counterparty_name: userMap.get(counterpartyId) ?? 'Unknown',
      mine_name: (mine?.name as string) ?? 'Unknown',
      harbour_name: (harbour?.name as string) ?? 'Unknown',
    } as DealWithDetails;
  });
}

export async function getDealsByUserLight(userId: string): Promise<Deal[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('deals')
    .select('*')
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data as Deal[];
}

export async function getDealById(dealId: string, userId: string): Promise<DealWithDetails | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('deals')
    .select(`
      *,
      listings!listing_id (
        commodity_type, spec_sheet, volume_tonnes, price_per_tonne,
        mines!source_mine_id (name, region),
        harbours!loading_port_id (name)
      )
    `)
    .eq('id', dealId)
    .single();

  if (error || !data) return null;

  // Verify user is a participant
  if (data.buyer_id !== userId && data.seller_id !== userId) return null;

  const counterpartyId = data.buyer_id === userId ? data.seller_id : data.buyer_id;
  const admin = createAdminSupabaseClient();
  const { data: counterparty } = await admin
    .from('users')
    .select('company_name')
    .eq('id', counterpartyId)
    .single();

  const listing = data.listings as Record<string, unknown> | null;
  const mine = listing?.mines as Record<string, unknown> | null;
  const harbour = listing?.harbours as Record<string, unknown> | null;

  return {
    ...data,
    counterparty_name: counterparty?.company_name ?? 'Unknown',
    mine_name: (mine?.name as string) ?? 'Unknown',
    harbour_name: (harbour?.name as string) ?? 'Unknown',
  } as DealWithDetails;
}

export async function getDealMilestones(dealId: string): Promise<DealMilestone[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('deal_milestones')
    .select('*')
    .eq('deal_id', dealId)
    .order('timestamp', { ascending: true });

  if (error || !data) return [];
  return data as DealMilestone[];
}

export async function getDealDocuments(dealId: string): Promise<DealDocument[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('deal_documents')
    .select('*')
    .eq('deal_id', dealId)
    .order('uploaded_at', { ascending: false });

  if (error || !data) return [];
  return data as DealDocument[];
}

export interface VerificationRequestRow {
  id: string;
  deal_id: string;
  inspector_type: string;
  inspector_company: string | null;
  status: string;
  requested_at: string;
  completed_at: string | null;
  results: Record<string, unknown> | null;
  report_file_url: string | null;
}

export async function getDealVerificationRequests(dealId: string): Promise<VerificationRequestRow[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('verification_requests')
    .select('id, deal_id, inspector_type, inspector_company, status, requested_at, completed_at, results, report_file_url')
    .eq('deal_id', dealId)
    .order('completed_at', { ascending: false, nullsFirst: false });

  if (error || !data) return [];
  return data as VerificationRequestRow[];
}

export async function getDealRatings(dealId: string): Promise<Rating[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('ratings')
    .select('*')
    .eq('deal_id', dealId);

  if (error || !data) return [];
  return data as Rating[];
}

export async function getCompletedDeals(commodity?: CommodityType): Promise<Deal[]> {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from('deals')
    .select('*')
    .in('status', ['completed', 'escrow_released'])
    .order('created_at', { ascending: false })
    .limit(PAGINATION.COMPLETED_DEALS_LIMIT);

  if (commodity) {
    query = query.eq('commodity_type', commodity);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data as Deal[];
}

export async function getTradingStats(commodity: CommodityType) {
  const supabase = await createServerSupabaseClient();

  // Active listings for this commodity
  const { data: listings } = await supabase
    .from('listings')
    .select('price_per_tonne, volume_tonnes')
    .eq('commodity_type', commodity)
    .eq('status', 'active');

  // Active deals
  const { data: activeDeals } = await supabase
    .from('deals')
    .select('agreed_price, volume_tonnes')
    .eq('commodity_type', commodity)
    .not('status', 'in', '("completed","cancelled","disputed")');

  // Recent completed deals
  const thirtyDaysAgo = new Date(Date.now() - PAGINATION.RECENT_DEALS_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentDeals } = await supabase
    .from('deals')
    .select('agreed_price, volume_tonnes, created_at')
    .eq('commodity_type', commodity)
    .in('status', ['completed', 'escrow_released'])
    .gte('created_at', thirtyDaysAgo)
    .order('created_at', { ascending: true });

  // Active requirements (bid side)
  const { data: requirements } = await supabase
    .from('requirements')
    .select('target_price, volume_needed')
    .eq('commodity_type', commodity)
    .eq('status', 'active');

  const listingsArr = listings ?? [];
  const activeDealsArr = activeDeals ?? [];
  const recentDealsArr = recentDeals ?? [];
  const requirementsArr = requirements ?? [];

  const avgAskPrice = listingsArr.length > 0
    ? listingsArr.reduce((sum, l) => sum + (l.price_per_tonne as number), 0) / listingsArr.length
    : 0;

  const avgBidPrice = requirementsArr.length > 0
    ? requirementsArr.reduce((sum, r) => sum + (r.target_price as number), 0) / requirementsArr.length
    : 0;

  const totalVolumeListed = listingsArr.reduce((sum, l) => sum + (l.volume_tonnes as number), 0);
  const totalDealValue = activeDealsArr.reduce(
    (sum, d) => sum + (d.agreed_price as number) * (d.volume_tonnes as number), 0
  );

  // Build price history from recent completed deals
  const priceHistory = recentDealsArr.map((d) => ({
    time: d.created_at as string,
    value: d.agreed_price as number,
  }));

  return {
    avgAskPrice,
    avgBidPrice,
    spread: avgAskPrice - avgBidPrice,
    totalVolumeListed,
    activeDealsCount: activeDealsArr.length,
    totalDealValue,
    priceHistory,
  };
}
