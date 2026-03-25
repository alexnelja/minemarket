import { describe, it, expect } from 'vitest';
import { calculateSeaRoute, selectVessel } from '../sea-routes';

describe('selectVessel', () => {
  it('selects handysize for <= 35000 tonnes', () => {
    expect(selectVessel(20000).label).toBe('Handysize');
    expect(selectVessel(35000).label).toBe('Handysize');
  });

  it('selects supramax for 35001-58000 tonnes', () => {
    expect(selectVessel(40000).label).toBe('Supramax');
    expect(selectVessel(58000).label).toBe('Supramax');
  });

  it('selects panamax for 58001-82000 tonnes', () => {
    expect(selectVessel(60000).label).toBe('Panamax');
    expect(selectVessel(82000).label).toBe('Panamax');
  });

  it('selects capesize for > 82000 tonnes', () => {
    expect(selectVessel(100000).label).toBe('Capesize');
    expect(selectVessel(180000).label).toBe('Capesize');
  });
});

describe('calculateSeaRoute', () => {
  // Richards Bay to Qingdao — a well-known bulk route
  const richardsBay = { lat: -28.801, lng: 32.038 };
  const qingdao = { lat: 36.067, lng: 120.383 };

  it('returns all required fields', () => {
    const result = calculateSeaRoute(richardsBay, qingdao, 50000);

    expect(result).toHaveProperty('coordinates');
    expect(result).toHaveProperty('distanceNm');
    expect(result).toHaveProperty('distanceKm');
    expect(result).toHaveProperty('transitDays');
    expect(result).toHaveProperty('fuelCostUsd');
    expect(result).toHaveProperty('freightRatePerTonne');
    expect(result).toHaveProperty('co2Tonnes');
    expect(result).toHaveProperty('vesselClass');
    expect(result).toHaveProperty('breakdown');
  });

  it('calculates positive distance', () => {
    const result = calculateSeaRoute(richardsBay, qingdao, 50000);
    expect(result.distanceNm).toBeGreaterThan(0);
    expect(result.distanceKm).toBeGreaterThan(0);
    expect(result.distanceKm).toBeCloseTo(result.distanceNm * 1.852, -2);
  });

  it('calculates reasonable transit days', () => {
    const result = calculateSeaRoute(richardsBay, qingdao, 50000);
    // Richards Bay to Qingdao is roughly 20-35 days
    expect(result.transitDays).toBeGreaterThan(10);
    expect(result.transitDays).toBeLessThan(60);
  });

  it('calculates freight rate in reasonable range ($5-30/t)', () => {
    const result = calculateSeaRoute(richardsBay, qingdao, 50000);
    expect(result.freightRatePerTonne).toBeGreaterThan(5);
    expect(result.freightRatePerTonne).toBeLessThan(30);
  });

  it('calculates positive CO2 proportional to fuel', () => {
    const result = calculateSeaRoute(richardsBay, qingdao, 50000);
    expect(result.co2Tonnes).toBeGreaterThan(0);

    // CO2 should be roughly 3.151 * fuel tonnes
    const fuelBreakdown = result.breakdown.find(b => b.label === 'Fuel consumption');
    expect(fuelBreakdown).toBeDefined();
    const fuelTonnes = parseFloat(fuelBreakdown!.value.replace(/[^0-9.]/g, ''));
    expect(result.co2Tonnes).toBeCloseTo(fuelTonnes * 3.151, 0);
  });

  it('uses correct vessel class based on volume', () => {
    const small = calculateSeaRoute(richardsBay, qingdao, 30000);
    expect(small.vesselClass).toBe('Handysize');

    const medium = calculateSeaRoute(richardsBay, qingdao, 50000);
    expect(medium.vesselClass).toBe('Supramax');

    const large = calculateSeaRoute(richardsBay, qingdao, 75000);
    expect(large.vesselClass).toBe('Panamax');

    const xlarge = calculateSeaRoute(richardsBay, qingdao, 150000);
    expect(xlarge.vesselClass).toBe('Capesize');
  });

  it('has coordinates array with at least 2 points', () => {
    const result = calculateSeaRoute(richardsBay, qingdao, 50000);
    expect(result.coordinates.length).toBeGreaterThanOrEqual(2);
  });

  it('has 10 breakdown items', () => {
    const result = calculateSeaRoute(richardsBay, qingdao, 50000);
    expect(result.breakdown).toHaveLength(10);
  });

  it('defaults volume to 50000 when not specified', () => {
    const result = calculateSeaRoute(richardsBay, qingdao);
    expect(result.vesselClass).toBe('Supramax');
  });
});
