import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server';
import { buildTermSheetData, type TermSheetDeal } from '@/lib/term-sheet-data';
import { renderTermSheetPdf } from '@/lib/term-sheet-pdf';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: deal, error } = await supabase
    .from('deals')
    .select('id, buyer_id, seller_id, commodity_type, commodity_subtype, volume_tonnes, agreed_price, currency, incoterm, spec_tolerances, price_adjustment_rules, created_at, second_accept_at')
    .eq('id', id)
    .single();

  if (error || !deal) {
    return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
  }

  if (deal.buyer_id !== user.id && deal.seller_id !== user.id) {
    return NextResponse.json({ error: 'Not authorized to view this deal' }, { status: 403 });
  }

  // Resolve party details via admin client (profile data + auth emails live
  // outside the deal row).
  const admin = createAdminSupabaseClient();
  const [buyerRes, sellerRes] = await Promise.all([
    admin.auth.admin.getUserById(deal.buyer_id),
    admin.auth.admin.getUserById(deal.seller_id),
  ]);
  const buyerUser = buyerRes.data.user;
  const sellerUser = sellerRes.data.user;

  const data = buildTermSheetData(deal as TermSheetDeal, {
    buyer: {
      id: deal.buyer_id,
      name: (buyerUser?.user_metadata?.company_name as string | undefined) ?? '',
      email: buyerUser?.email ?? '',
    },
    seller: {
      id: deal.seller_id,
      name: (sellerUser?.user_metadata?.company_name as string | undefined) ?? '',
      email: sellerUser?.email ?? '',
    },
  });

  const pdf = await renderTermSheetPdf(data);
  const filename = `term-sheet-${data.deal_ref}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
