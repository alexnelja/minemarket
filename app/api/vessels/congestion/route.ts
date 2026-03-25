import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  const admin = createAdminSupabaseClient();
  const { searchParams } = new URL(request.url);
  const harbourId = searchParams.get('harbour_id');

  let query = admin
    .from('port_congestion')
    .select('*, harbours!harbour_id(name, country)')
    .order('vessels_at_port', { ascending: false });

  if (harbourId) {
    query = query.eq('harbour_id', harbourId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
