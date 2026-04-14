import type { SpecComparisonSummary } from './spec-comparison';

export type LabSummaryTone = 'ok' | 'bonus' | 'penalty' | 'reject';

export interface LabSummary {
  headline: string;
  tone: LabSummaryTone;
  adjustmentLabel: string | null;
}

function formatAdjustment(total: number): string | null {
  if (total === 0) return null;
  const sign = total > 0 ? '+' : '-';
  return `${sign}$${Math.abs(total).toFixed(2)}/t`;
}

export function formatLabSummary(comparison: SpecComparisonSummary | null): LabSummary | null {
  if (!comparison || comparison.results.length === 0) return null;

  const { results, totalAdjustment, hasRejection } = comparison;
  const adjustmentLabel = formatAdjustment(totalAdjustment);

  if (hasRejection) {
    const rejected = results.filter((r) => r.status === 'reject').map((r) => r.field);
    return {
      headline: `Rejected — ${rejected.join(', ')} outside tolerance`,
      tone: 'reject',
      adjustmentLabel,
    };
  }

  const withinSpec = results.filter((r) => r.status === 'within_spec').length;
  const hasPenalty = results.some((r) => r.status === 'penalty');
  const hasBonus = results.some((r) => r.status === 'bonus');

  let tone: LabSummaryTone = 'ok';
  if (hasPenalty) tone = 'penalty';
  else if (hasBonus) tone = 'bonus';

  const headline =
    tone === 'ok'
      ? `${withinSpec}/${results.length} fields within spec`
      : tone === 'penalty'
        ? `${withinSpec}/${results.length} within spec · penalty applied`
        : `${withinSpec}/${results.length} within spec · bonus earned`;

  return { headline, tone, adjustmentLabel };
}
