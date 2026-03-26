import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const q = new URL(request.url).searchParams.get('q')?.trim();
  if (!q || q.length < 2) return NextResponse.json({ results: [] });

  const results: { type: string; id: string; title: string; subtitle: string; href: string }[] = [];

  // Search deals
  const { data: deals } = await supabase
    .from('deals')
    .select('id, commodity_type, status, agreed_price, volume_tonnes')
    .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
    .textSearch('commodity_type', q, { type: 'plain' })
    .limit(5);

  // If text search didn't match, try ilike on commodity_type
  if (!deals || deals.length === 0) {
    const { data: dealsIlike } = await supabase
      .from('deals')
      .select('id, commodity_type, status, agreed_price, volume_tonnes')
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .ilike('commodity_type', `%${q}%`)
      .limit(5);
    if (dealsIlike) {
      dealsIlike.forEach(d => results.push({
        type: 'deal', id: d.id, title: `${d.commodity_type} Deal`, subtitle: `$${d.agreed_price}/t · ${d.volume_tonnes}t · ${d.status}`, href: `/deals/${d.id}`,
      }));
    }
  } else {
    deals.forEach(d => results.push({
      type: 'deal', id: d.id, title: `${d.commodity_type} Deal`, subtitle: `$${d.agreed_price}/t · ${d.volume_tonnes}t · ${d.status}`, href: `/deals/${d.id}`,
    }));
  }

  // Search listings
  const { data: listings } = await supabase
    .from('listings')
    .select('id, commodity_type, price_per_tonne, volume_tonnes, status')
    .eq('status', 'active')
    .ilike('commodity_type', `%${q}%`)
    .limit(5);

  listings?.forEach(l => results.push({
    type: 'listing', id: l.id, title: `${l.commodity_type} Listing`, subtitle: `$${l.price_per_tonne}/t · ${l.volume_tonnes}t`, href: `/marketplace/listings/${l.id}`,
  }));

  // Search mines
  const { data: mines } = await supabase
    .from('mines')
    .select('id, name, country, commodities')
    .ilike('name', `%${q}%`)
    .limit(5);

  mines?.forEach(m => results.push({
    type: 'mine', id: m.id, title: m.name, subtitle: `${m.country} · ${(m.commodities || []).join(', ')}`, href: `/map`,
  }));

  // Search harbours
  const { data: ports } = await supabase
    .from('harbours')
    .select('id, name, country')
    .ilike('name', `%${q}%`)
    .limit(5);

  ports?.forEach(p => results.push({
    type: 'port', id: p.id, title: p.name, subtitle: p.country, href: `/map`,
  }));

  // Static page results
  const pages = [
    { title: 'Deal Simulator', subtitle: 'Calculate margins on any trade route', href: '/simulator' },
    { title: 'Position Book', subtitle: 'Aggregate exposure across deals', href: '/positions' },
    { title: 'Contract Book', subtitle: 'Track documents across deals', href: '/contracts' },
    { title: 'Map', subtitle: 'Explore mines, ports, and vessels', href: '/map' },
    { title: 'Marketplace', subtitle: 'Browse listings and requirements', href: '/marketplace' },
    { title: 'Trading', subtitle: 'Price charts and market data', href: '/trading' },
    { title: 'KYC Documents', subtitle: 'Upload company verification docs', href: '/dashboard/kyc' },
    { title: 'Vessels', subtitle: 'Live vessel tracking', href: '/vessels' },
  ];

  pages.filter(p => p.title.toLowerCase().includes(q.toLowerCase()) || p.subtitle.toLowerCase().includes(q.toLowerCase()))
    .forEach(p => results.push({ type: 'page', id: p.href, title: p.title, subtitle: p.subtitle, href: p.href }));

  return NextResponse.json({ results: results.slice(0, 15) });
}
