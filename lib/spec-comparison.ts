/**
 * Spec tolerance comparison engine.
 *
 * Compares actual delivered spec against the agreed spec_tolerances on a deal,
 * calculates price adjustments using price_adjustment_rules, and flags rejections.
 */

export interface SpecTolerance {
  target: number;
  accept_range: [number, number];
  penalty_range?: [number, number];
  reject_below?: number;
  reject_above?: number;
}

export interface PriceAdjustmentRule {
  penalty_per_pct_below?: number;
  bonus_per_pct_above?: number;
  reference?: string;
}

export interface SpecComparisonResult {
  field: string;
  target: number;
  actual: number;
  deviation: number; // percentage points from target
  status: 'within_spec' | 'penalty' | 'bonus' | 'reject';
  priceAdjustment: number; // $/t (negative = penalty, positive = bonus)
}

export interface SpecComparisonSummary {
  results: SpecComparisonResult[];
  totalAdjustment: number;
  hasRejection: boolean;
}

export function compareSpecs(
  specTolerances: Record<string, SpecTolerance>,
  priceAdjustmentRules: Record<string, PriceAdjustmentRule>,
  actualSpec: Record<string, number>,
): SpecComparisonSummary {
  const results: SpecComparisonResult[] = [];
  let totalAdjustment = 0;
  let hasRejection = false;

  for (const [field, tolerance] of Object.entries(specTolerances)) {
    const actual = actualSpec[field];
    if (actual == null) continue;

    const { target, accept_range, penalty_range, reject_below, reject_above } = tolerance;
    const deviation = actual - target;
    const rule = priceAdjustmentRules[field];

    let status: SpecComparisonResult['status'] = 'within_spec';
    let priceAdjustment = 0;

    // Check rejection thresholds first
    if (reject_below != null && actual < reject_below) {
      status = 'reject';
      hasRejection = true;
    } else if (reject_above != null && actual > reject_above) {
      status = 'reject';
      hasRejection = true;
    }
    // Check if within acceptable range
    else if (actual >= accept_range[0] && actual <= accept_range[1]) {
      status = 'within_spec';
      priceAdjustment = 0;
    }
    // Below accept range — penalty zone
    else if (actual < accept_range[0]) {
      // Check if within penalty range (if defined) or just below accept
      if (penalty_range && actual >= penalty_range[0]) {
        status = 'penalty';
        const pctBelow = accept_range[0] - actual;
        priceAdjustment = rule?.penalty_per_pct_below
          ? -(pctBelow * rule.penalty_per_pct_below)
          : 0;
      } else if (penalty_range && actual < penalty_range[0]) {
        // Below penalty range — reject
        status = 'reject';
        hasRejection = true;
      } else {
        // No penalty range defined, treat as penalty
        status = 'penalty';
        const pctBelow = accept_range[0] - actual;
        priceAdjustment = rule?.penalty_per_pct_below
          ? -(pctBelow * rule.penalty_per_pct_below)
          : 0;
      }
    }
    // Above accept range — bonus zone
    else if (actual > accept_range[1]) {
      status = 'bonus';
      const pctAbove = actual - accept_range[1];
      priceAdjustment = rule?.bonus_per_pct_above
        ? pctAbove * rule.bonus_per_pct_above
        : 0;
    }

    totalAdjustment += priceAdjustment;

    results.push({
      field,
      target,
      actual,
      deviation,
      status,
      priceAdjustment: Math.round(priceAdjustment * 100) / 100,
    });
  }

  return {
    results,
    totalAdjustment: Math.round(totalAdjustment * 100) / 100,
    hasRejection,
  };
}
