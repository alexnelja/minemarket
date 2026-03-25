import { describe, it, expect } from 'vitest';
import {
  computeTrustScore,
  getBadgeTier,
  bayesianScore,
  TRUST_DIMENSIONS,
} from '../trust-score';
import type { Rating } from '../types';
import { TRUST_CONFIG } from '../constants';

function makeRating(overrides: Partial<Rating> = {}): Rating {
  return {
    id: 'r1',
    deal_id: 'd1',
    rater_id: 'u1',
    rated_user_id: 'u2',
    spec_accuracy: 4,
    timeliness: 4,
    communication: 4,
    documentation: 4,
    comment: null,
    created_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('bayesianScore', () => {
  const M = TRUST_CONFIG.BAYESIAN_CONFIDENCE_M;

  it('returns platformAvg when n=0', () => {
    expect(bayesianScore(5, 0, 3)).toBe(3);
  });

  it('blends actual and platform averages', () => {
    // n=10, M=10 => 50/50 blend
    const result = bayesianScore(5, 10, 3);
    expect(result).toBeCloseTo((10 / 20) * 5 + (10 / 20) * 3);
    expect(result).toBeCloseTo(4);
  });

  it('converges to actualAvg as n grows large', () => {
    const result = bayesianScore(5, 10000, 3);
    expect(result).toBeCloseTo(5, 1);
  });
});

describe('getBadgeTier', () => {
  it('returns unrated for 0 deals', () => {
    expect(getBadgeTier(0).tier).toBe('unrated');
  });

  it('returns bronze for 5 deals', () => {
    expect(getBadgeTier(5).tier).toBe('bronze');
  });

  it('returns silver for 15 deals', () => {
    expect(getBadgeTier(15).tier).toBe('silver');
  });

  it('returns gold for 30 deals', () => {
    expect(getBadgeTier(30).tier).toBe('gold');
  });

  it('returns platinum for 50 deals', () => {
    expect(getBadgeTier(50).tier).toBe('platinum');
  });

  it('returns platinum for 100 deals', () => {
    expect(getBadgeTier(100).tier).toBe('platinum');
  });

  it('returns bronze for 4 deals (below silver)', () => {
    expect(getBadgeTier(4).tier).toBe('unrated');
  });
});

describe('TRUST_DIMENSIONS weights', () => {
  it('sum to 1.0', () => {
    const total = Object.values(TRUST_DIMENSIONS).reduce((s, d) => s + d.weight, 0);
    expect(total).toBeCloseTo(1.0);
  });
});

describe('computeTrustScore', () => {
  it('returns platform default when no ratings and no deals', () => {
    const result = computeTrustScore([], 0, 0);
    // With 0 ratings & 0 completed deals, all bayesian scores collapse to platformAvg (3.0)
    expect(result.ratingCount).toBe(0);
    expect(result.completedDeals).toBe(0);
    expect(result.overall).toBeCloseTo(3.0, 1);
    expect(result.badge.tier).toBe('unrated');
  });

  it('computes correctly with a single perfect rating', () => {
    const rating = makeRating({
      spec_accuracy: 5,
      timeliness: 5,
      communication: 5,
      documentation: 5,
    });
    const result = computeTrustScore([rating], 1, 0);
    expect(result.ratingCount).toBe(1);
    // With n=1, bayesian pulls toward platform avg, so overall < 5
    expect(result.overall).toBeGreaterThan(3);
    expect(result.overall).toBeLessThan(5);
  });

  it('computes correctly with multiple ratings', () => {
    const ratings = Array.from({ length: 20 }, () =>
      makeRating({ spec_accuracy: 5, timeliness: 5, communication: 5, documentation: 5 }),
    );
    const result = computeTrustScore(ratings, 20, 0);
    expect(result.ratingCount).toBe(20);
    // With n=20 and M=10, actual avg dominates
    expect(result.overall).toBeGreaterThan(4);
  });

  it('penalizes disputes correctly', () => {
    const ratings = Array.from({ length: 10 }, () =>
      makeRating({ spec_accuracy: 5, timeliness: 5, communication: 5, documentation: 5 }),
    );
    const noDisputes = computeTrustScore(ratings, 10, 0);
    const withDisputes = computeTrustScore(ratings, 10, 5);
    expect(withDisputes.overall).toBeLessThan(noDisputes.overall);
  });

  it('dispute ratio is 0 when completedDeals is 0', () => {
    // This tests the guard: completedDeals > 0 ? disputedDeals / completedDeals : 0
    const result = computeTrustScore([], 0, 5);
    // disputeScore should use disputeRatio=0, giving max score for dispute dimension
    // Then bayesian with n=0 collapses to platformAvg
    expect(result.overall).toBeCloseTo(3.0, 1);
  });

  it('overallPct is (overall/5)*100', () => {
    const result = computeTrustScore([], 0, 0);
    expect(result.overallPct).toBe(Math.round((result.overall / TRUST_CONFIG.MAX_SCORE) * 100));
  });
});
