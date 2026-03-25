/**
 * Default spec tolerance templates per commodity subtype.
 * These become the starting point for negotiation when a deal is created.
 * Values reflect real-world SA bulk minerals trading standards.
 */

export interface SpecToleranceTemplate {
  commodity: string;
  subtypes: string[]; // which subtypes this applies to
  tolerances: Record<string, {
    target: number;
    accept_range: [number, number];
    penalty_range?: [number, number];
    reject_below?: number;
    reject_above?: number;
  }>;
  adjustmentRules: Record<string, {
    penalty_per_unit_below?: number;
    bonus_per_unit_above?: number;
    reference: string; // 'per_tonne' or 'per_pct'
  }>;
}

// ─── Chrome 42% ──────────────────────────────────────────────────────────────

const CHROME_42_TEMPLATE: SpecToleranceTemplate = {
  commodity: 'chrome',
  subtypes: ['chrome_met_lumpy', 'chrome_met_conc', 'chrome_ug2'],
  tolerances: {
    cr2o3_pct: {
      target: 42,
      accept_range: [40, 44],
      penalty_range: [39, 40],
      reject_below: 39,
    },
    cr_fe_ratio: {
      target: 1.5,
      accept_range: [1.4, 1.8],
      reject_below: 1.3,
    },
    sio2_pct: {
      target: 5,
      accept_range: [3, 7],
      reject_above: 9,
    },
    al2o3_pct: {
      target: 14,
      accept_range: [12, 16],
      reject_above: 18,
    },
    fe_pct: {
      target: 25,
      accept_range: [22, 28],
    },
    moisture_pct: {
      target: 5,
      accept_range: [3, 6],
      penalty_range: [6, 8],
      reject_above: 8,
    },
  },
  adjustmentRules: {
    cr2o3_pct: {
      penalty_per_unit_below: 2.5,
      bonus_per_unit_above: 1.5,
      reference: 'per_pct',
    },
    moisture_pct: {
      penalty_per_unit_below: 0.5,
      reference: 'per_pct',
    },
  },
};

// ─── Iron Ore 62% ────────────────────────────────────────────────────────────

const IRON_ORE_62_TEMPLATE: SpecToleranceTemplate = {
  commodity: 'iron_ore',
  subtypes: ['iron_ore_fines_std', 'iron_ore_fines_high', 'iron_ore_lump'],
  tolerances: {
    fe_pct: {
      target: 62,
      accept_range: [61, 63],
      penalty_range: [60, 61],
      reject_below: 58,
    },
    sio2_pct: {
      target: 4,
      accept_range: [3, 5],
      penalty_range: [5, 6],
      reject_above: 6,
    },
    al2o3_pct: {
      target: 2.25,
      accept_range: [1.5, 3],
      penalty_range: [3, 3.5],
      reject_above: 3.5,
    },
    p_pct: {
      target: 0.07,
      accept_range: [0.05, 0.1],
      reject_above: 0.15,
    },
    s_pct: {
      target: 0.02,
      accept_range: [0.01, 0.03],
      reject_above: 0.05,
    },
    moisture_pct: {
      target: 8,
      accept_range: [6, 9],
      penalty_range: [9, 10.5],
      reject_above: 10.5,
    },
    loi_pct: {
      target: 3,
      accept_range: [2, 4],
      reject_above: 6,
    },
  },
  adjustmentRules: {
    fe_pct: {
      penalty_per_unit_below: 1.5,
      bonus_per_unit_above: 1.0,
      reference: 'per_pct',
    },
    sio2_pct: {
      penalty_per_unit_below: 1.0,
      reference: 'per_pct',
    },
    al2o3_pct: {
      penalty_per_unit_below: 1.0,
      reference: 'per_pct',
    },
    moisture_pct: {
      penalty_per_unit_below: 0.5,
      reference: 'per_pct',
    },
  },
};

// ─── Coal RB1 ────────────────────────────────────────────────────────────────

const COAL_RB1_TEMPLATE: SpecToleranceTemplate = {
  commodity: 'coal',
  subtypes: ['coal_rb1', 'coal_rb2', 'coal_rb3'],
  tolerances: {
    cv_kcal_nar: {
      target: 6000,
      accept_range: [5850, 6150],
      penalty_range: [5700, 5850],
      reject_below: 5500,
    },
    ash_pct: {
      target: 15,
      accept_range: [12, 16],
      penalty_range: [16, 18],
      reject_above: 18,
    },
    volatile_pct: {
      target: 24,
      accept_range: [22, 28],
    },
    s_pct: {
      target: 0.8,
      accept_range: [0.5, 1.0],
      reject_above: 1.5,
    },
    moisture_pct: {
      target: 10,
      accept_range: [8, 12],
      reject_above: 14,
    },
    hgi: {
      target: 50,
      accept_range: [45, 65],
    },
  },
  adjustmentRules: {
    cv_kcal_nar: {
      penalty_per_unit_below: 0.01,
      bonus_per_unit_above: 0.005,
      reference: 'per_tonne',
    },
    ash_pct: {
      penalty_per_unit_below: 0.5,
      reference: 'per_pct',
    },
    s_pct: {
      penalty_per_unit_below: 2.0,
      reference: 'per_pct',
    },
  },
};

// ─── Manganese 44% ───────────────────────────────────────────────────────────

const MANGANESE_44_TEMPLATE: SpecToleranceTemplate = {
  commodity: 'manganese',
  subtypes: ['mn_high_grade', 'mn_medium_grade', 'mn_supergrade'],
  tolerances: {
    mn_pct: {
      target: 44,
      accept_range: [42, 46],
      penalty_range: [40, 42],
      reject_below: 38,
    },
    fe_pct: {
      target: 6,
      accept_range: [4, 8],
      reject_above: 10,
    },
    sio2_pct: {
      target: 6,
      accept_range: [4, 8],
      reject_above: 10,
    },
    p_pct: {
      target: 0.06,
      accept_range: [0.04, 0.08],
      reject_above: 0.1,
    },
    al2o3_pct: {
      target: 4,
      accept_range: [3, 6],
      reject_above: 8,
    },
    moisture_pct: {
      target: 5,
      accept_range: [3, 7],
      reject_above: 10,
    },
  },
  adjustmentRules: {
    mn_pct: {
      penalty_per_unit_below: 0.02,
      bonus_per_unit_above: 0.01,
      reference: 'per_pct',
    },
    p_pct: {
      penalty_per_unit_below: 5.0,
      reference: 'per_pct',
    },
  },
};

// ─── All templates ───────────────────────────────────────────────────────────

export const SPEC_TOLERANCE_TEMPLATES: SpecToleranceTemplate[] = [
  CHROME_42_TEMPLATE,
  IRON_ORE_62_TEMPLATE,
  COAL_RB1_TEMPLATE,
  MANGANESE_44_TEMPLATE,
];

/**
 * Look up the default spec tolerance template for a commodity + subtype.
 * Returns the first template whose commodity matches and whose subtypes
 * array includes the given subtype. Falls back to any template matching
 * the commodity if no subtype match is found.
 */
export function getDefaultTolerances(
  commodity: string,
  subtype?: string,
): SpecToleranceTemplate | null {
  // Try exact subtype match first
  if (subtype) {
    const exact = SPEC_TOLERANCE_TEMPLATES.find(
      (t) => t.commodity === commodity && t.subtypes.includes(subtype),
    );
    if (exact) return exact;
  }

  // Fall back to commodity-level match
  const fallback = SPEC_TOLERANCE_TEMPLATES.find(
    (t) => t.commodity === commodity,
  );
  return fallback ?? null;
}
