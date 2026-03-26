import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server';

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

interface RouteContext { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  const { id: dealId } = await context.params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: deal } = await supabase.from('deals').select('buyer_id, seller_id, commodity_type').eq('id', dealId).single();
  if (!deal || (deal.buyer_id !== user.id && deal.seller_id !== user.id)) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const { email } = await request.json();
  if (!email?.trim()) return NextResponse.json({ error: 'Email required' }, { status: 400 });

  // Send invite via Resend
  const RESEND_API_KEY = process.env.RESEND_API_KEY || process.env.RESEND_KEY;
  if (!RESEND_API_KEY) {
    return NextResponse.json({ error: 'Email service not configured' }, { status: 500 });
  }

  // Get sender's company name
  const admin = createAdminSupabaseClient();
  const { data: senderProfile } = await admin.from('users').select('company_name').eq('id', user.id).single();
  const senderName = senderProfile?.company_name || 'A trader';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({
      from: 'MineMarket <onboarding@resend.dev>',
      to: [email],
      subject: `${escapeHtml(senderName)} invited you to a deal on MineMarket`,
      html: `
        <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;background:#0f172a;color:#e2e8f0;padding:32px;border-radius:12px;">
          <h2 style="color:#f59e0b;font-size:18px;margin:0 0 8px;">You've been invited to a deal</h2>
          <p style="color:#94a3b8;font-size:13px;margin:0 0 20px;">${escapeHtml(senderName)} wants to work with you on a ${escapeHtml(deal.commodity_type)} deal through MineMarket.</p>
          <a href="https://dashboard-five-cyan-36.vercel.app/deals/${dealId}" style="display:block;text-align:center;background:#f59e0b;color:#000;font-weight:600;font-size:14px;padding:12px;border-radius:8px;text-decoration:none;">View Deal</a>
          <p style="color:#475569;font-size:11px;text-align:center;margin-top:24px;">MineMarket · The deal workspace for commodity traders</p>
        </div>
      `,
    }),
  });

  if (!res.ok) return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  return NextResponse.json({ sent: true });
}
