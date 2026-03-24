import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { id: dealId } = await context.params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify participation
  const { data: deal } = await supabase
    .from('deals')
    .select('buyer_id, seller_id')
    .eq('id', dealId)
    .single();

  if (!deal || (deal.buyer_id !== user.id && deal.seller_id !== user.id)) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const body = await request.json();
  const { milestone_type, location_name, notes } = body;

  if (!milestone_type) {
    return NextResponse.json({ error: 'milestone_type is required' }, { status: 400 });
  }

  const { data: milestone, error } = await supabase
    .from('deal_milestones')
    .insert({
      deal_id: dealId,
      milestone_type,
      timestamp: new Date().toISOString(),
      location_name: location_name ?? null,
      notes: notes ?? null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(milestone, { status: 201 });
}
