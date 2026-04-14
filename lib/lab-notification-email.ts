import type { LabSummary } from './lab-summary';

export interface LabNotificationDeal {
  id: string;
  commodityType: string;
  volumeTonnes: number;
}

export interface LabNotificationArgs {
  deal: LabNotificationDeal;
  inspectorCompany: string | null;
  labSummary: LabSummary;
  appUrl: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const TONE_COLORS: Record<LabSummary['tone'], { bg: string; border: string; text: string }> = {
  ok: { bg: '#064e3b', border: '#065f46', text: '#6ee7b7' },
  bonus: { bg: '#1e3a8a', border: '#1d4ed8', text: '#93c5fd' },
  penalty: { bg: '#78350f', border: '#b45309', text: '#fcd34d' },
  reject: { bg: '#7f1d1d', border: '#b91c1c', text: '#fca5a5' },
};

export function buildLabNotificationEmail(args: LabNotificationArgs): { subject: string; html: string } {
  const { deal, inspectorCompany, labSummary, appUrl } = args;
  const ref = deal.id.slice(0, 8);
  const prefix = labSummary.tone === 'reject' ? 'REJECTED · ' : '';
  const subject = `${prefix}Lab results: ${deal.commodityType} · ${deal.volumeTonnes.toLocaleString()}t · Ref ${ref}`;

  const colors = TONE_COLORS[labSummary.tone];
  const companyLabel = inspectorCompany ? escapeHtml(inspectorCompany) : 'Lab';

  const html = `
    <div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;background:#0f172a;color:#e2e8f0;padding:32px;border-radius:12px;">
      <h2 style="color:#f59e0b;font-size:18px;margin:0 0 8px;">Lab Results Uploaded</h2>
      <p style="color:#94a3b8;font-size:13px;margin:0 0 20px;">${companyLabel} has submitted assay results for your ${escapeHtml(deal.commodityType)} deal (${deal.volumeTonnes.toLocaleString()}t, ref ${escapeHtml(ref)}).</p>

      <div style="background:${colors.bg};border:1px solid ${colors.border};border-radius:8px;padding:16px;margin:0 0 20px;">
        <p style="color:${colors.text};font-size:15px;font-weight:600;margin:0;">${escapeHtml(labSummary.headline)}</p>
        ${labSummary.adjustmentLabel ? `<p style="color:${colors.text};font-size:14px;margin:8px 0 0;">Price adjustment: ${escapeHtml(labSummary.adjustmentLabel)}</p>` : ''}
      </div>

      <a href="${escapeHtml(appUrl)}/deals/${escapeHtml(deal.id)}" style="display:block;text-align:center;background:#f59e0b;color:#000;font-weight:600;font-size:14px;padding:12px;border-radius:8px;text-decoration:none;">View Deal & Full Breakdown</a>
    </div>
  `.trim();

  return { subject, html };
}
