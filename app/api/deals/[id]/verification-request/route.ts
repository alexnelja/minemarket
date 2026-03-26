import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server';

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

interface RouteContext { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  const { id: dealId } = await context.params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: deal } = await supabase
    .from('deals')
    .select('buyer_id, seller_id')
    .eq('id', dealId)
    .single();

  if (!deal || (deal.buyer_id !== user.id && deal.seller_id !== user.id)) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const { data } = await supabase
    .from('verification_requests')
    .select('*')
    .eq('deal_id', dealId)
    .order('requested_at', { ascending: false });

  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { id: dealId } = await context.params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify participation
  const { data: deal } = await supabase.from('deals').select('buyer_id, seller_id, commodity_type, volume_tonnes').eq('id', dealId).single();
  if (!deal || (deal.buyer_id !== user.id && deal.seller_id !== user.id)) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const body = await request.json();
  const { inspector_type, inspector_company, inspector_email, notes } = body;

  if (!inspector_type) return NextResponse.json({ error: 'inspector_type required' }, { status: 400 });

  const { data: vr, error } = await supabase
    .from('verification_requests')
    .insert({
      deal_id: dealId,
      inspector_type,
      inspector_company: inspector_company || null,
      inspector_email: inspector_email || null,
      notes: notes || null,
      requested_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Send email to inspector if email provided
  if (inspector_email) {
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (RESEND_API_KEY) {
      const admin = createAdminSupabaseClient();
      const { data: profile } = await admin.from('users').select('company_name').eq('id', user.id).single();
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://dashboard-five-cyan-36.vercel.app';

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({
          from: 'MineMarket <onboarding@resend.dev>',
          to: [inspector_email],
          subject: `Inspection request: ${escapeHtml(deal.commodity_type)} · ${deal.volume_tonnes}t · Ref: ${dealId.slice(0, 8)}`,
          html: `
            <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;background:#0f172a;color:#e2e8f0;padding:32px;border-radius:12px;">
              <h2 style="color:#f59e0b;font-size:18px;margin:0 0 8px;">Inspection Request</h2>
              <p style="color:#94a3b8;font-size:13px;">${escapeHtml(profile?.company_name || 'A trader')} has requested a ${escapeHtml(inspector_type.replace(/_/g, ' '))} for a ${escapeHtml(deal.commodity_type)} deal (${deal.volume_tonnes.toLocaleString()}t).</p>
              <div style="background:#1e293b;border-radius:8px;padding:16px;margin:16px 0;">
                <p style="font-size:13px;color:#e2e8f0;">Type: ${escapeHtml(inspector_type.replace(/_/g, ' '))}</p>
                <p style="font-size:13px;color:#e2e8f0;">Commodity: ${escapeHtml(deal.commodity_type)}</p>
                <p style="font-size:13px;color:#e2e8f0;">Volume: ${deal.volume_tonnes.toLocaleString()}t</p>
                <p style="font-size:13px;color:#e2e8f0;">Reference: ${dealId.slice(0, 8)}</p>
                ${notes ? `<p style="font-size:13px;color:#94a3b8;">Notes: ${escapeHtml(notes)}</p>` : ''}
              </div>
              <p style="color:#94a3b8;font-size:12px;">Please upload your report and results to the MineMarket platform once complete.</p>
              <a href="${appUrl}/deals/${dealId}" style="display:block;text-align:center;background:#f59e0b;color:#000;font-weight:600;font-size:14px;padding:12px;border-radius:8px;text-decoration:none;margin-top:16px;">View Deal</a>
            </div>
          `,
        }),
      }).catch(() => {});
    }
  }

  return NextResponse.json(vr, { status: 201 });
}
