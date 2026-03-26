import { describe, it, expect } from 'vitest';
import { calculateTimeline, type TimelineParams } from '../supply-chain-timeline';

// Coords for common SA locations
const STEELPOORT: { lat: number; lng: number } = { lat: -24.69, lng: 30.19 };
const RICHARDS_BAY: { lat: number; lng: number } = { lat: -28.801, lng: 32.038 };
const DURBAN: { lat: number; lng: number } = { lat: -29.868, lng: 31.048 };
const QINGDAO: { lat: number; lng: number } = { lat: 36.067, lng: 120.383 };

const baseParams: TimelineParams = {
  mineCoords: STEELPOORT,
  portCoords: RICHARDS_BAY,
  destinationCoords: QINGDAO,
  mineName: 'Steelpoort Chrome',
  portName: 'Richards Bay',
  destinationName: 'Qingdao',
  transportMode: 'rail',
  volumeTonnes: 15000,
  buyPoint: 'mine_gate',
  sellPoint: 'cif',
  includePaymentTimeline: false,
};

describe('calculateTimeline', () => {
  it('known SA rail route (Steelpoort Chrome → Richards Bay) returns correct distance-based duration', () => {
    const result = calculateTimeline(baseParams);
    const inlandSegment = result.segments.find(s => s.segment === 'inland_transit');
    expect(inlandSegment).toBeDefined();
    // Known route: 620km via mainline (350 km/day) = ceil(620/350) = 2 days
    expect(inlandSegment!.durationDays).toBe(2);
    expect(inlandSegment!.method).toBe('calculated');
    expect(inlandSegment!.note).toContain('620km');
  });

  it('unknown route falls back to Haversine calculation', () => {
    const params: TimelineParams = {
      ...baseParams,
      mineName: 'Unknown Mine',
    };
    const result = calculateTimeline(params);
    const inlandSegment = result.segments.find(s => s.segment === 'inland_transit');
    expect(inlandSegment).toBeDefined();
    expect(inlandSegment!.method).toBe('estimated');
    // Should contain approximate distance from haversine
    expect(inlandSegment!.note).toMatch(/~\d+km/);
  });

  it('port-specific loading rates: Richards Bay 15000 vs Durban 8000 t/day', () => {
    // Richards Bay: 15000 t/day for 15000t = 1 day
    const rbResult = calculateTimeline(baseParams);
    const rbLoading = rbResult.segments.find(s => s.segment === 'vessel_loading');
    expect(rbLoading).toBeDefined();
    expect(rbLoading!.durationDays).toBe(1); // ceil(15000/15000) = 1

    // Durban: 8000 t/day for 15000t = 2 days
    const durbanResult = calculateTimeline({
      ...baseParams,
      portCoords: DURBAN,
      portName: 'Durban',
      mineName: 'Steelpoort Chrome',
    });
    const durbanLoading = durbanResult.segments.find(s => s.segment === 'vessel_loading');
    expect(durbanLoading).toBeDefined();
    expect(durbanLoading!.durationDays).toBe(2); // ceil(15000/8000) = 2
  });

  it('congestion-adjusted waiting time: low=1d, medium=3d, high=7d', () => {
    const levels = [
      { level: 'low', expectedDays: 1 },
      { level: 'medium', expectedDays: 3 },
      { level: 'high', expectedDays: 7 },
    ];

    for (const { level, expectedDays } of levels) {
      const result = calculateTimeline({
        ...baseParams,
        portCongestion: { level, vesselCount: 10 },
      });
      const waitSegment = result.segments.find(s => s.segment === 'vessel_waiting');
      expect(waitSegment).toBeDefined();
      expect(waitSegment!.durationDays).toBe(expectedDays);
      expect(waitSegment!.method).toBe('calculated');
    }
  });

  it('FOB sell point excludes ocean/discharge segments', () => {
    const result = calculateTimeline({
      ...baseParams,
      sellPoint: 'fob',
    });
    const oceanSegment = result.segments.find(s => s.segment === 'ocean_transit');
    const dischargeSegment = result.segments.find(s => s.segment === 'discharge');
    const anchorageSegment = result.segments.find(s => s.segment === 'anchorage_wait');
    expect(oceanSegment).toBeUndefined();
    expect(dischargeSegment).toBeUndefined();
    expect(anchorageSegment).toBeUndefined();
  });

  it('CIF sell point includes all segments', () => {
    const result = calculateTimeline(baseParams);
    const oceanSegment = result.segments.find(s => s.segment === 'ocean_transit');
    const dischargeSegment = result.segments.find(s => s.segment === 'discharge');
    const anchorageSegment = result.segments.find(s => s.segment === 'anchorage_wait');
    const customsImport = result.segments.find(s => s.segment === 'customs_import');
    expect(oceanSegment).toBeDefined();
    expect(dischargeSegment).toBeDefined();
    expect(anchorageSegment).toBeDefined();
    expect(customsImport).toBeDefined();
  });

  it('mine gate buy point includes inland segment', () => {
    const result = calculateTimeline({
      ...baseParams,
      buyPoint: 'mine_gate',
    });
    const inlandSegment = result.segments.find(s => s.segment === 'inland_transit');
    const mineLoading = result.segments.find(s => s.segment === 'mine_loading');
    expect(inlandSegment).toBeDefined();
    expect(mineLoading).toBeDefined();
  });

  it('port gate buy point excludes inland', () => {
    const result = calculateTimeline({
      ...baseParams,
      buyPoint: 'port_gate',
    });
    const inlandSegment = result.segments.find(s => s.segment === 'inland_transit');
    const mineLoading = result.segments.find(s => s.segment === 'mine_loading');
    expect(inlandSegment).toBeUndefined();
    expect(mineLoading).toBeUndefined();
  });

  it('payment timeline segments included when flag is true', () => {
    const result = calculateTimeline({
      ...baseParams,
      includePaymentTimeline: true,
    });
    const lcSegment = result.segments.find(s => s.segment === 'lc_presentation');
    const bankSegment = result.segments.find(s => s.segment === 'bank_processing');
    const fundsSegment = result.segments.find(s => s.segment === 'funds_receipt');
    expect(lcSegment).toBeDefined();
    expect(lcSegment!.durationDays).toBe(3);
    expect(bankSegment).toBeDefined();
    expect(bankSegment!.durationDays).toBe(5);
    expect(fundsSegment).toBeDefined();
    expect(fundsSegment!.durationDays).toBe(3);
  });

  it('payment timeline segments excluded when flag is false', () => {
    const result = calculateTimeline({
      ...baseParams,
      includePaymentTimeline: false,
    });
    const lcSegment = result.segments.find(s => s.segment === 'lc_presentation');
    expect(lcSegment).toBeUndefined();
  });

  it('total days = sum of all segment durations', () => {
    const result = calculateTimeline(baseParams);
    const sumOfSegments = result.segments.reduce((sum, s) => sum + s.durationDays, 0);
    expect(result.totalDays).toBe(sumOfSegments);
  });

  it('timeline with custom averageSeaSpeed uses that speed', () => {
    const defaultResult = calculateTimeline(baseParams);
    const customResult = calculateTimeline({
      ...baseParams,
      averageSeaSpeed: 10,
    });

    const defaultOcean = defaultResult.segments.find(s => s.segment === 'ocean_transit');
    const customOcean = customResult.segments.find(s => s.segment === 'ocean_transit');

    expect(defaultOcean).toBeDefined();
    expect(customOcean).toBeDefined();
    // Slower speed should mean more days
    expect(customOcean!.durationDays).toBeGreaterThanOrEqual(defaultOcean!.durationDays);
    // Custom speed should be marked as 'calculated' and mention AIS
    expect(customOcean!.method).toBe('calculated');
    expect(customOcean!.note).toContain('AIS');
  });
});
