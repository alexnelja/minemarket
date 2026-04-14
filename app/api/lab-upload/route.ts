import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase-server';
import { parseAssayData, buildResultsPayload, inferInspectorType } from '@/lib/lab-upload-parse';

export async function POST(request: NextRequest) {
  const admin = createAdminSupabaseClient();
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const dealRef = formData.get('deal_ref') as string;
  const inspectorName = formData.get('inspector_name') as string;
  const company = formData.get('company') as string;
  const reportType = formData.get('report_type') as string;
  const commodity = formData.get('commodity') as string | null;
  const assayDataRaw = formData.get('assay_data') as string | null;

  if (!file || !dealRef || !inspectorName || !company) {
    return NextResponse.json({ error: 'Deal reference, inspector, company and file are required' }, { status: 400 });
  }

  // Parse optional assay data
  const parsedAssay = parseAssayData(assayDataRaw);
  if (parsedAssay === 'invalid') {
    return NextResponse.json({ error: 'Invalid assay data' }, { status: 400 });
  }
  const assayData = parsedAssay?.data ?? null;

  // Find the deal by reference code prefix
  const { data: deals } = await admin
    .from('deals')
    .select('id, buyer_id, seller_id, commodity_type')
    .ilike('id', `${dealRef}%`)
    .limit(1);

  if (!deals || deals.length === 0) {
    return NextResponse.json({ error: 'Deal not found. Check the reference code.' }, { status: 404 });
  }

  const deal = deals[0];

  // If caller declared a commodity, it must match the deal
  if (commodity && commodity !== deal.commodity_type) {
    return NextResponse.json({
      error: `Commodity mismatch: this deal is ${deal.commodity_type}, you selected ${commodity}`,
    }, { status: 400 });
  }

  // Upload file to storage
  const filePath = `deals/${deal.id}/lab-${Date.now()}-${file.name}`;
  const { error: uploadError } = await admin.storage.from('deal-documents').upload(filePath, file);
  if (uploadError) {
    return NextResponse.json({ error: 'File upload failed' }, { status: 500 });
  }

  // Create document record
  const { error: docError } = await admin.from('deal_documents').insert({
    deal_id: deal.id,
    doc_type: reportType,
    file_url: filePath,
    uploaded_by: deal.seller_id,
    verified: false,
  });

  if (docError) {
    return NextResponse.json({ error: docError.message }, { status: 500 });
  }

  // Find an existing pending/in_progress verification request to complete,
  // otherwise create a new completed one so the assay data is captured.
  const { data: existing } = await admin
    .from('verification_requests')
    .select('id')
    .eq('deal_id', deal.id)
    .in('status', ['pending', 'assigned', 'in_progress'])
    .order('requested_at', { ascending: false })
    .limit(1);

  const resultsPayload = buildResultsPayload({
    inspectorName,
    reportType,
    assay: assayData,
  });

  if (existing && existing.length > 0) {
    await admin.from('verification_requests')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        inspector_company: company,
        report_file_url: filePath,
        results: resultsPayload,
      })
      .eq('id', existing[0].id);
  } else {
    await admin.from('verification_requests').insert({
      deal_id: deal.id,
      inspector_type: inferInspectorType(reportType),
      inspector_company: company,
      status: 'completed',
      completed_at: new Date().toISOString(),
      report_file_url: filePath,
      results: resultsPayload,
    });
  }

  return NextResponse.json({ success: true });
}
