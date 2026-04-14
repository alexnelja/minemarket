import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server';

// GET /api/scenarios/[id] — get scenario by ID or share token
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Try share token first (public access, no auth needed)
  const adminSupabase = createAdminSupabaseClient();
  const { data: shared } = await adminSupabase
    .from('deal_scenarios')
    .select('*')
    .eq('share_token', id)
    .single();

  if (shared) {
    return NextResponse.json({ scenario: shared, isShared: true });
  }

  // Try by ID (requires auth)
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
  }

  const { data, error } = await supabase
    .from('deal_scenarios')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
  }

  return NextResponse.json({ scenario: data, isShared: false });
}

// PATCH /api/scenarios/[id] — update scenario name or link to deal
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.name) updates.name = body.name;
  if (body.deal_id) updates.deal_id = body.deal_id;

  const { data, error } = await supabase
    .from('deal_scenarios')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Failed to update scenario' }, { status: 500 });
  }

  return NextResponse.json({ scenario: data });
}

// DELETE /api/scenarios/[id] — delete scenario
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { error } = await supabase
    .from('deal_scenarios')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: 'Failed to delete scenario' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
