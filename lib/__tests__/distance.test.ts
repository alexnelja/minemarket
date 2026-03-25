import { describe, it, expect } from 'vitest';
import {
  haversineDistance,
  estimateSeaDistance,
  estimateTransitDays,
  estimateCarbonFootprint,
  estimateRoute,
  formatDistance,
} from '../distance';

describe('haversineDistance', () => {
  it('calculates Cape Town to Shanghai (~7,000 nm great-circle)', () => {
    // Cape Town: -33.92, 18.42  Shanghai: 31.23, 121.47
    const nm = haversineDistance(-33.92, 18.42, 31.23, 121.47);
    expect(nm).toBeGreaterThan(6_800);
    expect(nm).toBeLessThan(7_200);
  });

  it('calculates Richards Bay to Qingdao (~6,300 nm great-circle)', () => {
    // Richards Bay: -28.78, 32.09  Qingdao: 36.067, 120.383
    const nm = haversineDistance(-28.78, 32.09, 36.067, 120.383);
    expect(nm).toBeGreaterThan(6_100);
    expect(nm).toBeLessThan(6_500);
  });

  it('returns 0 for identical coordinates', () => {
    expect(haversineDistance(0, 0, 0, 0)).toBe(0);
  });
});

describe('estimateSeaDistance', () => {
  it('applies 1.4x multiplier to great-circle distance', () => {
    const gcDist = haversineDistance(-33.92, 18.42, 31.23, 121.47);
    const seaDist = estimateSeaDistance(-33.92, 18.42, 31.23, 121.47);
    expect(seaDist).toBeCloseTo(gcDist * 1.4, 0);
  });
});

describe('estimateTransitDays', () => {
  it('calculates transit at default 13 knots', () => {
    // 3,120 nm at 13 knots = 240 hours = 10 days
    const days = estimateTransitDays(3_120);
    expect(days).toBeCloseTo(10, 0);
  });

  it('calculates transit at custom speed', () => {
    // 2,400 nm at 12 knots = 200 hours = 8.33 days
    const days = estimateTransitDays(2_400, 12);
    expect(days).toBeCloseTo(8.33, 1);
  });
});

describe('estimateCarbonFootprint', () => {
  it('calculates sea transport CO₂', () => {
    // 10,000 km * 5,000 tonnes * 0.008 kg/t-km = 400,000 kg = 400 tonnes
    const co2 = estimateCarbonFootprint(10_000, 5_000, 'sea');
    expect(co2).toBe(400);
  });

  it('calculates rail transport CO₂', () => {
    // 1,000 km * 1,000 tonnes * 0.022 kg/t-km = 22,000 kg = 22 tonnes
    const co2 = estimateCarbonFootprint(1_000, 1_000, 'rail');
    expect(co2).toBe(22);
  });

  it('calculates road transport CO₂', () => {
    // 500 km * 100 tonnes * 0.062 kg/t-km = 3,100 kg = 3.1 tonnes
    const co2 = estimateCarbonFootprint(500, 100, 'road');
    expect(co2).toBe(3.1);
  });
});

describe('estimateRoute', () => {
  it('returns a complete RouteEstimate', () => {
    // Richards Bay to Qingdao, 50,000 tonnes
    const route = estimateRoute(-28.78, 32.09, 36.067, 120.383, 50_000);

    expect(route).toHaveProperty('nauticalMiles');
    expect(route).toHaveProperty('km');
    expect(route).toHaveProperty('transitDays');
    expect(route).toHaveProperty('co2Tonnes');

    expect(route.nauticalMiles).toBeGreaterThan(7_000);
    expect(route.km).toBeGreaterThan(13_000);
    expect(route.transitDays).toBeGreaterThan(20);
    expect(route.co2Tonnes).toBeGreaterThan(0);
  });

  it('values are internally consistent', () => {
    const route = estimateRoute(-33.92, 18.42, 36.067, 120.383, 10_000);

    // km should be nm * 1.852
    expect(route.km).toBeCloseTo(route.nauticalMiles * 1.852, -1);
  });
});

describe('formatDistance', () => {
  it('formats with nm and km', () => {
    const result = formatDistance(1234);
    expect(result).toContain('1,234 nm');
    expect(result).toContain('2,285 km');
  });

  it('formats large distances', () => {
    const result = formatDistance(8500);
    expect(result).toContain('8,500 nm');
  });
});
