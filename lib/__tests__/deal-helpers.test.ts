import { describe, it, expect } from 'vitest';
import {
  canTransition,
  canTransitionAsRole,
  getNextStatuses,
  getNextStatusesForRole,
  canAddMilestone,
  DEAL_STATUS_LABELS,
  DEAL_STATUS_COLORS,
  PIPELINE_COLUMNS,
  MILESTONE_ORDER,
  MILESTONE_ROLES,
} from '../deal-helpers';
import type { DealStatus } from '../types';

const ALL_STATUSES: DealStatus[] = [
  'interest', 'first_accept', 'negotiation', 'second_accept',
  'escrow_held', 'loading', 'in_transit', 'delivered',
  'escrow_released', 'completed', 'disputed', 'cancelled',
];

describe('canTransition', () => {
  it('allows valid transitions', () => {
    expect(canTransition('interest', 'first_accept')).toBe(true);
    expect(canTransition('interest', 'cancelled')).toBe(true);
    expect(canTransition('escrow_held', 'loading')).toBe(true);
    expect(canTransition('in_transit', 'delivered')).toBe(true);
    expect(canTransition('escrow_released', 'completed')).toBe(true);
  });

  it('rejects invalid transitions', () => {
    expect(canTransition('interest', 'completed')).toBe(false);
    expect(canTransition('completed', 'interest')).toBe(false);
    expect(canTransition('cancelled', 'interest')).toBe(false);
    expect(canTransition('loading', 'escrow_held')).toBe(false);
  });

  it('returns false for terminal statuses', () => {
    expect(getNextStatuses('completed')).toEqual([]);
    expect(getNextStatuses('cancelled')).toEqual([]);
  });
});

describe('canTransitionAsRole', () => {
  it('allows seller to move interest -> first_accept', () => {
    expect(canTransitionAsRole('interest', 'first_accept', 'seller')).toBe(true);
  });

  it('blocks buyer from interest -> first_accept', () => {
    expect(canTransitionAsRole('interest', 'first_accept', 'buyer')).toBe(false);
  });

  it('allows either party to cancel from interest', () => {
    expect(canTransitionAsRole('interest', 'cancelled', 'buyer')).toBe(true);
    expect(canTransitionAsRole('interest', 'cancelled', 'seller')).toBe(true);
  });

  it('allows buyer to confirm delivery', () => {
    expect(canTransitionAsRole('in_transit', 'delivered', 'buyer')).toBe(true);
  });

  it('blocks seller from confirming delivery', () => {
    expect(canTransitionAsRole('in_transit', 'delivered', 'seller')).toBe(false);
  });

  it('returns false for invalid transitions', () => {
    expect(canTransitionAsRole('completed', 'interest', 'buyer')).toBe(false);
  });
});

describe('getNextStatuses', () => {
  it('returns correct options for interest', () => {
    expect(getNextStatuses('interest')).toEqual(['first_accept', 'cancelled']);
  });

  it('returns empty for terminal statuses', () => {
    expect(getNextStatuses('completed')).toEqual([]);
    expect(getNextStatuses('cancelled')).toEqual([]);
  });
});

describe('getNextStatusesForRole', () => {
  it('filters by seller role from escrow_held', () => {
    const statuses = getNextStatusesForRole('escrow_held', 'seller');
    expect(statuses).toContain('loading');
    expect(statuses).toContain('disputed');
    expect(statuses).toContain('cancelled');
  });

  it('filters by buyer role from escrow_held', () => {
    const statuses = getNextStatusesForRole('escrow_held', 'buyer');
    // buyer cannot trigger loading (seller only), but can dispute or cancel
    expect(statuses).not.toContain('loading');
    expect(statuses).toContain('disputed');
    expect(statuses).toContain('cancelled');
  });
});

describe('canAddMilestone', () => {
  it('allows seller to add loaded milestone', () => {
    expect(canAddMilestone('loaded', 'seller')).toBe(true);
  });

  it('blocks buyer from adding loaded milestone', () => {
    expect(canAddMilestone('loaded', 'buyer')).toBe(false);
  });

  it('allows buyer to add delivered milestone', () => {
    expect(canAddMilestone('delivered', 'buyer')).toBe(true);
  });

  it('allows either party for in_transit milestone', () => {
    expect(canAddMilestone('in_transit', 'buyer')).toBe(true);
    expect(canAddMilestone('in_transit', 'seller')).toBe(true);
  });

  it('returns false for unknown milestone type', () => {
    expect(canAddMilestone('unknown_type', 'buyer')).toBe(false);
  });
});

describe('PIPELINE_COLUMNS', () => {
  it('covers all non-terminal statuses', () => {
    const terminalStatuses: DealStatus[] = ['completed', 'disputed', 'cancelled'];
    const nonTerminal = ALL_STATUSES.filter((s) => !terminalStatuses.includes(s));
    const covered = PIPELINE_COLUMNS.flatMap((col) => col.statuses);
    for (const status of nonTerminal) {
      expect(covered).toContain(status);
    }
  });
});

describe('DEAL_STATUS_LABELS and DEAL_STATUS_COLORS', () => {
  it('has labels for all DealStatus values', () => {
    for (const status of ALL_STATUSES) {
      expect(DEAL_STATUS_LABELS[status]).toBeDefined();
      expect(typeof DEAL_STATUS_LABELS[status]).toBe('string');
    }
  });

  it('has colors for all DealStatus values', () => {
    for (const status of ALL_STATUSES) {
      expect(DEAL_STATUS_COLORS[status]).toBeDefined();
      expect(DEAL_STATUS_COLORS[status].bg).toBeDefined();
      expect(DEAL_STATUS_COLORS[status].text).toBeDefined();
      expect(DEAL_STATUS_COLORS[status].border).toBeDefined();
    }
  });
});
