import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

// GET /api/scenarios — list user's saved scenarios
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('deal_scenarios')
    .select('id, name, commodity, commodity_subtype, sell_price, sell_point, buy_point, volume_tonnes, mine_name, loading_port, destination_name, breakeven_buy_price, total_costs, transport_mode, share_token, deal_id, index_price_used, grade, created_at, updated_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ scenarios: data || [] });
}

// POST /api/scenarios — save a new scenario
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required to save scenarios' }, { status: 401 });
  }

  const body = await request.json();

  const { name, commodity, commodity_subtype, grade, sell_price, sell_point, buy_point,
    volume_tonnes, mine_name, mine_lat, mine_lng, loading_port, loading_port_lat,
    loading_port_lng, destination_name, destination_lat, destination_lng,
    breakeven_buy_price, total_costs, selected_route, all_routes, cost_breakdown,
    verification_checkpoints, transport_mode, fx_hedge, cost_overrides, index_price_used,
  } = body;

  if (!name || !commodity || !sell_price) {
    return NextResponse.json({ error: 'Missing required fields: name, commodity, sell_price' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('deal_scenarios')
    .insert({
      user_id: user.id,
      name,
      commodity,
      commodity_subtype: commodity_subtype || null,
      grade: grade || null,
      sell_price,
      sell_point: sell_point || 'cif',
      buy_point: buy_point || 'mine_gate',
      volume_tonnes: volume_tonnes || 15000,
      mine_name: mine_name || null,
      mine_lat: mine_lat || null,
      mine_lng: mine_lng || null,
      loading_port: loading_port || null,
      loading_port_lat: loading_port_lat || null,
      loading_port_lng: loading_port_lng || null,
      destination_name: destination_name || null,
      destination_lat: destination_lat || null,
      destination_lng: destination_lng || null,
      breakeven_buy_price: breakeven_buy_price || null,
      total_costs: total_costs || null,
      selected_route: selected_route || null,
      all_routes: all_routes || null,
      cost_breakdown: cost_breakdown || null,
      verification_checkpoints: verification_checkpoints || null,
      transport_mode: transport_mode || 'rail',
      fx_hedge: fx_hedge || 'spot',
      cost_overrides: cost_overrides || null,
      index_price_used: index_price_used || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ scenario: data }, { status: 201 });
}
