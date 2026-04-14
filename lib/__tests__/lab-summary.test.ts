import { describe, it, expect } from 'vitest';
import { formatLabSummary } from '../lab-summary';
import type { SpecComparisonSummary } from '../spec-comparison';

describe('formatLabSummary', () => {
  it('returns null when comparison is null', () => {
    expect(formatLabSummary(null)).toBeNull();
  });

  it('returns null when comparison has no results', () => {
    const empty: SpecComparisonSummary = { results: [], totalAdjustment: 0, hasRejection: false };
    expect(formatLabSummary(empty)).toBeNull();
  });

  it('reports all-within-spec with zero adjustment', () => {
    const c: SpecComparisonSummary = {
      results: [
        { field: 'cr2o3_pct', target: 42, actual: 42, deviation: 0, status: 'within_spec', priceAdjustment: 0 },
        { field: 'fe_pct', target: 24, actual: 24.5, deviation: 0.5, status: 'within_spec', priceAdjustment: 0 },
      ],
      totalAdjustment: 0,
      hasRejection: false,
    };
    const s = formatLabSummary(c);
    expect(s).toEqual({
      headline: '2/2 fields within spec',
      tone: 'ok',
      adjustmentLabel: null,
    });
  });

  it('reports rejection with failing field names', () => {
    const c: SpecComparisonSummary = {
      results: [
        { field: 'cr2o3_pct', target: 42, actual: 35, deviation: -7, status: 'reject', priceAdjustment: 0 },
        { field: 'fe_pct', target: 24, actual: 24, deviation: 0, status: 'within_spec', priceAdjustment: 0 },
      ],
      totalAdjustment: 0,
      hasRejection: true,
    };
    const s = formatLabSummary(c);
    expect(s?.tone).toBe('reject');
    expect(s?.headline).toMatch(/reject/i);
    expect(s?.headline).toContain('cr2o3_pct');
  });

  it('reports penalty with formatted negative adjustment', () => {
    const c: SpecComparisonSummary = {
      results: [
        { field: 'cr2o3_pct', target: 42, actual: 39, deviation: -3, status: 'penalty', priceAdjustment: -2.5 },
      ],
      totalAdjustment: -2.5,
      hasRejection: false,
    };
    const s = formatLabSummary(c);
    expect(s?.tone).toBe('penalty');
    expect(s?.adjustmentLabel).toBe('-$2.50/t');
  });

  it('reports bonus with formatted positive adjustment', () => {
    const c: SpecComparisonSummary = {
      results: [
        { field: 'cr2o3_pct', target: 42, actual: 45, deviation: 3, status: 'bonus', priceAdjustment: 1.75 },
      ],
      totalAdjustment: 1.75,
      hasRejection: false,
    };
    const s = formatLabSummary(c);
    expect(s?.tone).toBe('bonus');
    expect(s?.adjustmentLabel).toBe('+$1.75/t');
  });

  it('prefers reject tone even when some fields pass', () => {
    const c: SpecComparisonSummary = {
      results: [
        { field: 'a', target: 1, actual: 1, deviation: 0, status: 'within_spec', priceAdjustment: 0 },
        { field: 'b', target: 1, actual: 0, deviation: -1, status: 'reject', priceAdjustment: 0 },
      ],
      totalAdjustment: 0,
      hasRejection: true,
    };
    expect(formatLabSummary(c)?.tone).toBe('reject');
  });
});
