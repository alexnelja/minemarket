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

  // Verify deal is completed and user is a participant
  const { data: deal } = await supabase
    .from('deals')
    .select('buyer_id, seller_id, status')
    .eq('id', dealId)
    .single();

  if (!deal || (deal.buyer_id !== user.id && deal.seller_id !== user.id)) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  if (!['completed', 'escrow_released'].includes(deal.status)) {
    return NextResponse.json({ error: 'Deal must be completed to leave a rating' }, { status: 400 });
  }

  // Check if already rated
  const { data: existing } = await supabase
    .from('ratings')
    .select('id')
    .eq('deal_id', dealId)
    .eq('rater_id', user.id)
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json({ error: 'You have already rated this deal' }, { status: 409 });
  }

  const body = await request.json();
  const { spec_accuracy, timeliness, communication, documentation, comment } = body;

  // Validate ratings are 1-5
  for (const [field, value] of Object.entries({ spec_accuracy, timeliness, communication, documentation })) {
    if (typeof value !== 'number' || value < 1 || value > 5) {
      return NextResponse.json({ error: `${field} must be between 1 and 5` }, { status: 400 });
    }
  }

  const ratedUserId = deal.buyer_id === user.id ? deal.seller_id : deal.buyer_id;

  const { data: rating, error } = await supabase
    .from('ratings')
    .insert({
      deal_id: dealId,
      rater_id: user.id,
      rated_user_id: ratedUserId,
      spec_accuracy,
      timeliness,
      communication,
      documentation,
      comment: comment ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(rating, { status: 201 });
}
