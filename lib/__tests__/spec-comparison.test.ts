import { describe, it, expect } from 'vitest';
import { compareSpecs } from '../spec-comparison';
import type { SpecTolerance, PriceAdjustmentRule } from '../spec-comparison';

const tolerances: Record<string, SpecTolerance> = {
  cr2o3_pct: {
    target: 42,
    accept_range: [40, 44],
    penalty_range: [38, 46],
    reject_below: 36,
  },
  fe_pct: {
    target: 24,
    accept_range: [22, 26],
    reject_above: 30,
  },
  moisture_pct: {
    target: 5,
    accept_range: [4, 6],
    reject_above: 8,
  },
};

const rules: Record<string, PriceAdjustmentRule> = {
  cr2o3_pct: { penalty_per_pct_below: 2.5, bonus_per_pct_above: 1.5 },
  fe_pct: { penalty_per_pct_below: 1.0 },
  moisture_pct: { penalty_per_pct_below: 0.5 },
};

describe('compareSpecs', () => {
  it('returns within_spec when all values at target', () => {
    const actual = { cr2o3_pct: 42, fe_pct: 24, moisture_pct: 5 };
    const result = compareSpecs(tolerances, rules, actual);

    expect(result.hasRejection).toBe(false);
    expect(result.totalAdjustment).toBe(0);
    expect(result.results).toHaveLength(3);
    for (const r of result.results) {
      expect(r.status).toBe('within_spec');
      expect(r.priceAdjustment).toBe(0);
    }
  });

  it('returns within_spec when values within accept_range', () => {
    const actual = { cr2o3_pct: 41, fe_pct: 23, moisture_pct: 5.5 };
    const result = compareSpecs(tolerances, rules, actual);

    expect(result.hasRejection).toBe(false);
    expect(result.totalAdjustment).toBe(0);
    for (const r of result.results) {
      expect(r.status).toBe('within_spec');
    }
  });

  it('calculates penalty when below accept_range', () => {
    const actual = { cr2o3_pct: 39, fe_pct: 24, moisture_pct: 5 };
    const result = compareSpecs(tolerances, rules, actual);

    expect(result.hasRejection).toBe(false);
    const cr = result.results.find((r) => r.field === 'cr2o3_pct')!;
    expect(cr.status).toBe('penalty');
    // 40 - 39 = 1 pct below, penalty_per_pct_below = 2.5, so -2.5
    expect(cr.priceAdjustment).toBe(-2.5);
    expect(result.totalAdjustment).toBe(-2.5);
  });

  it('calculates bonus when above accept_range', () => {
    const actual = { cr2o3_pct: 45, fe_pct: 24, moisture_pct: 5 };
    const result = compareSpecs(tolerances, rules, actual);

    expect(result.hasRejection).toBe(false);
    const cr = result.results.find((r) => r.field === 'cr2o3_pct')!;
    expect(cr.status).toBe('bonus');
    // 45 - 44 = 1 pct above, bonus_per_pct_above = 1.5, so +1.5
    expect(cr.priceAdjustment).toBe(1.5);
    expect(result.totalAdjustment).toBe(1.5);
  });

  it('flags rejection when below reject_below', () => {
    const actual = { cr2o3_pct: 35, fe_pct: 24, moisture_pct: 5 };
    const result = compareSpecs(tolerances, rules, actual);

    expect(result.hasRejection).toBe(true);
    const cr = result.results.find((r) => r.field === 'cr2o3_pct')!;
    expect(cr.status).toBe('reject');
  });

  it('flags rejection when above reject_above', () => {
    const actual = { cr2o3_pct: 42, fe_pct: 31, moisture_pct: 5 };
    const result = compareSpecs(tolerances, rules, actual);

    expect(result.hasRejection).toBe(true);
    const fe = result.results.find((r) => r.field === 'fe_pct')!;
    expect(fe.status).toBe('reject');
  });

  it('rejects when below penalty_range lower bound', () => {
    const actual = { cr2o3_pct: 37, fe_pct: 24, moisture_pct: 5 };
    const result = compareSpecs(tolerances, rules, actual);

    expect(result.hasRejection).toBe(true);
    const cr = result.results.find((r) => r.field === 'cr2o3_pct')!;
    expect(cr.status).toBe('reject');
  });

  it('handles multiple adjustments', () => {
    const actual = { cr2o3_pct: 39, fe_pct: 21, moisture_pct: 5 };
    const result = compareSpecs(tolerances, rules, actual);

    const cr = result.results.find((r) => r.field === 'cr2o3_pct')!;
    const fe = result.results.find((r) => r.field === 'fe_pct')!;
    expect(cr.status).toBe('penalty');
    expect(fe.status).toBe('penalty');
    // cr: -(40-39)*2.5 = -2.5, fe: -(22-21)*1.0 = -1.0
    expect(result.totalAdjustment).toBe(-3.5);
  });

  it('skips fields not in actualSpec', () => {
    const actual = { cr2o3_pct: 42 };
    const result = compareSpecs(tolerances, rules, actual);

    expect(result.results).toHaveLength(1);
    expect(result.results[0].field).toBe('cr2o3_pct');
  });

  it('handles empty inputs', () => {
    const result = compareSpecs({}, {}, {});
    expect(result.results).toHaveLength(0);
    expect(result.totalAdjustment).toBe(0);
    expect(result.hasRejection).toBe(false);
  });
});
