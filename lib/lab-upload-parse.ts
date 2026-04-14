export interface ParsedAssay {
  data: Record<string, number>;
}

export function parseAssayData(raw: string | null | undefined): ParsedAssay | null | 'invalid' {
  if (raw == null || raw === '') return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return 'invalid';
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return 'invalid';
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isNaN(n) && Number.isFinite(n)) out[k] = n;
  }
  return { data: out };
}

export interface LabResultsPayload {
  inspector_name: string;
  report_type: string;
  assay?: Record<string, number>;
}

export function buildResultsPayload(args: {
  inspectorName: string;
  reportType: string;
  assay?: Record<string, number> | null;
}): LabResultsPayload {
  return {
    inspector_name: args.inspectorName,
    report_type: args.reportType,
    ...(args.assay && Object.keys(args.assay).length > 0 ? { assay: args.assay } : {}),
  };
}

export function inferInspectorType(reportType: string): 'lab_assay' | 'draft_survey' {
  return reportType === 'draft_survey' ? 'draft_survey' : 'lab_assay';
}
