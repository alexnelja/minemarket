import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { unauthorized, badRequest, notFound, forbidden, conflict, serverError } from '@/lib/api-helpers';

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  const body = await request.json();
  const { listing_id } = body;

  if (!listing_id) {
    return badRequest('listing_id is required');
  }

  // Fetch the listing
  const { data: listing, error: listingError } = await supabase
    .from('listings')
    .select('*')
    .eq('id', listing_id)
    .eq('status', 'active')
    .single();

  if (listingError || !listing) {
    return notFound('Listing not found or not active');
  }

  // Cannot express interest in your own listing
  if (listing.seller_id === user.id) {
    return badRequest('Cannot express interest in your own listing');
  }

  // Enforce allocation mode
  if (listing.allocation_mode === 'invite_only') {
    const preferredIds: string[] = listing.preferred_buyer_ids ?? [];
    if (!preferredIds.includes(user.id)) {
      return forbidden('This listing is invite-only');
    }
  }

  // Enforce max_buyers
  if (listing.max_buyers) {
    const { count } = await supabase
      .from('deals')
      .select('id', { count: 'exact', head: true })
      .eq('listing_id', listing_id)
      .not('status', 'in', '("cancelled")');

    if ((count ?? 0) >= listing.max_buyers) {
      return badRequest('This listing has reached its maximum number of buyers');
    }
  }

  // Check for existing deal on this listing by this buyer
  const { data: existing } = await supabase
    .from('deals')
    .select('id')
    .eq('listing_id', listing_id)
    .eq('buyer_id', user.id)
    .not('status', 'in', '("cancelled")')
    .limit(1);

  if (existing && existing.length > 0) {
    return conflict('You already have an active deal on this listing', { existing_deal_id: existing[0].id });
  }

  // Create the deal
  const { data: deal, error: dealError } = await supabase
    .from('deals')
    .insert({
      listing_id,
      buyer_id: user.id,
      seller_id: listing.seller_id,
      commodity_type: listing.commodity_type,
      commodity_subtype: listing.commodity_subtype || null,
      volume_tonnes: listing.volume_tonnes,
      agreed_price: listing.price_per_tonne,
      currency: listing.currency,
      incoterm: listing.incoterms[0],
      spec_tolerances: {},
      price_adjustment_rules: {},
      escrow_status: 'pending_deposit',
      status: 'interest',
    })
    .select()
    .single();

  if (dealError) {
    return serverError(dealError);
  }

  return NextResponse.json(deal, { status: 201 });
}
