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

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const docType = formData.get('doc_type') as string | null;

  if (!file || !docType) {
    return NextResponse.json({ error: 'file and doc_type are required' }, { status: 400 });
  }

  // Upload to Supabase Storage
  const filePath = `deals/${dealId}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from('deal-documents')
    .upload(filePath, file);

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  // Create document record
  const { data: doc, error: docError } = await supabase
    .from('deal_documents')
    .insert({
      deal_id: dealId,
      doc_type: docType,
      file_url: filePath,
      uploaded_by: user.id,
      verified: false,
    })
    .select()
    .single();

  if (docError) {
    return NextResponse.json({ error: docError.message }, { status: 500 });
  }

  return NextResponse.json(doc, { status: 201 });
}
