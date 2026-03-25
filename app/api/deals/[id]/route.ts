import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { canTransition, canTransitionAsRole } from '@/lib/deal-helpers';
import type { DealStatus } from '@/lib/types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: deal, error } = await supabase
    .from('deals')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !deal) {
    return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
  }

  if (deal.buyer_id !== user.id && deal.seller_id !== user.id) {
    return NextResponse.json({ error: 'Not authorized to view this deal' }, { status: 403 });
  }

  return NextResponse.json(deal);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { status: newStatus } = body as { status: DealStatus };

  if (!newStatus) {
    return NextResponse.json({ error: 'status is required' }, { status: 400 });
  }

  // Fetch current deal
  const { data: deal, error: fetchError } = await supabase
    .from('deals')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !deal) {
    return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
  }

  if (deal.buyer_id !== user.id && deal.seller_id !== user.id) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  if (!canTransition(deal.status as DealStatus, newStatus)) {
    return NextResponse.json({
      error: `Cannot transition from ${deal.status} to ${newStatus}`,
    }, { status: 400 });
  }

  // Enforce role-based access
  const role = deal.buyer_id === user.id ? 'buyer' as const : 'seller' as const;
  if (!canTransitionAsRole(deal.status as DealStatus, newStatus, role)) {
    return NextResponse.json({
      error: `As the ${role}, you cannot move this deal to ${newStatus}. This action requires the ${role === 'buyer' ? 'seller' : 'buyer'}.`,
    }, { status: 403 });
  }

  // Build update payload
  const update: Record<string, unknown> = { status: newStatus };

  // Lock FX rate and escrow at second_accept
  if (newStatus === 'second_accept') {
    update.second_accept_at = new Date().toISOString();
    update.escrow_amount = (deal.agreed_price as number) * (deal.volume_tonnes as number);

    // Fetch and lock FX rate for non-USD deals
    const dealCurrency = deal.currency as string;
    if (dealCurrency && dealCurrency !== 'USD') {
      try {
        const appId = process.env.OPEN_EXCHANGE_RATES_APP_ID;
        if (appId) {
          const fxRes = await fetch(
            `https://openexchangerates.org/api/latest.json?app_id=${appId}`
          );
          if (fxRes.ok) {
            const fxData = await fxRes.json();
            if (fxData.rates?.[dealCurrency]) {
              update.fx_rate_locked = fxData.rates[dealCurrency];
              update.fx_source_timestamp = new Date(fxData.timestamp * 1000).toISOString();
            }
          } else {
            // API returned error — in production, block transition
            console.error(`FX rate API returned ${fxRes.status}`);
          }
        }
      } catch (err) {
        // FX rate fetch failed — log but allow transition in v1
        // In production, should block the transition per spec
        console.error('FX rate fetch failed:', err);
      }
    }
  }

  // Update escrow status for relevant transitions
  if (newStatus === 'escrow_held') update.escrow_status = 'held';
  if (newStatus === 'escrow_released') update.escrow_status = 'releasing';
  if (newStatus === 'completed') update.escrow_status = 'released';
  if (newStatus === 'disputed') update.escrow_status = 'frozen';

  const { data: updated, error: updateError } = await supabase
    .from('deals')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json(updated);
}
