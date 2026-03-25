import { describe, it, expect } from 'vitest';
import { MAP_CONFIG, TRUST_CONFIG, SHIPMENT_CONFIG, PAGINATION } from '../constants';
import { MILESTONE_ORDER } from '../deal-helpers';

describe('MAP_CONFIG', () => {
  it('SA_CENTER longitude is valid (-180..180)', () => {
    const [lng] = MAP_CONFIG.SA_CENTER;
    expect(lng).toBeGreaterThanOrEqual(-180);
    expect(lng).toBeLessThanOrEqual(180);
  });

  it('SA_CENTER latitude is valid (-90..90)', () => {
    const [, lat] = MAP_CONFIG.SA_CENTER;
    expect(lat).toBeGreaterThanOrEqual(-90);
    expect(lat).toBeLessThanOrEqual(90);
  });

  it('SHIPMENT_CENTER longitude is valid (-180..180)', () => {
    const [lng] = MAP_CONFIG.SHIPMENT_CENTER;
    expect(lng).toBeGreaterThanOrEqual(-180);
    expect(lng).toBeLessThanOrEqual(180);
  });

  it('SHIPMENT_CENTER latitude is valid (-90..90)', () => {
    const [, lat] = MAP_CONFIG.SHIPMENT_CENTER;
    expect(lat).toBeGreaterThanOrEqual(-90);
    expect(lat).toBeLessThanOrEqual(90);
  });
});

describe('TRUST_CONFIG', () => {
  it('BAYESIAN_CONFIDENCE_M is positive', () => {
    expect(TRUST_CONFIG.BAYESIAN_CONFIDENCE_M).toBeGreaterThan(0);
  });

  it('MAX_SCORE is greater than MIN_SCORE', () => {
    expect(TRUST_CONFIG.MAX_SCORE).toBeGreaterThan(TRUST_CONFIG.MIN_SCORE);
  });
});

describe('SHIPMENT_CONFIG', () => {
  it('TOTAL_MILESTONES matches MILESTONE_ORDER length', () => {
    expect(SHIPMENT_CONFIG.TOTAL_MILESTONES).toBe(MILESTONE_ORDER.length);
  });
});

describe('PAGINATION', () => {
  it('COMPLETED_DEALS_LIMIT is positive', () => {
    expect(PAGINATION.COMPLETED_DEALS_LIMIT).toBeGreaterThan(0);
  });

  it('RECENT_DEALS_DAYS is positive', () => {
    expect(PAGINATION.RECENT_DEALS_DAYS).toBeGreaterThan(0);
  });
});
