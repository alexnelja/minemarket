import { describe, it, expect } from 'vitest';
import { simulateDeal, STAGE_DURATIONS } from '../forward-waterfall';
import type { SimulationParams } from '../forward-waterfall';

// Standard test params: Chrome from Tharisa mine via Richards Bay to Qingdao
const BASE_PARAMS: SimulationParams = {
  mineGatePrice: 151,
  commodity: 'chrome',
  volumeTonnes: 15000,
  loadingPort: 'Richards Bay',
  loadingPortCoords: { lat: -28.801, lng: 32.038 },
  destinationCoords: { lat: 36.067, lng: 120.383 },
  destinationName: 'Qingdao, China',
  mineCoords: { lat: -25.75, lng: 27.85 },
  mineName: 'Tharisa',
  transportMode: 'rail',
};

describe('simulateDeal — forward waterfall', () => {
  it('produces steps where subtotals always increase (forward direction)', () => {
    const result = simulateDeal(BASE_PARAMS);
    // Filter only cost-adding steps (not markers)
    const costSteps = result.steps.filter(s => s.amount > 0 && !s.label.startsWith('='));
    for (const step of costSteps) {
      expect(step.amount).toBeGreaterThan(0);
    }
    // Subtotals should generally increase (excluding margin rows)
    const nonMarginSteps = result.steps.filter(s => !s.label.includes('MARGIN') && !s.label.includes('Index'));
    for (let i = 1; i < nonMarginSteps.length; i++) {
      expect(nonMarginSteps[i].subtotal).toBeGreaterThanOrEqual(nonMarginSteps[i - 1].subtotal);
    }
  });

  it('CIF price is greater than mine gate price', () => {
    const result = simulateDeal(BASE_PARAMS);
    expect(result.cifPrice).toBeGreaterThan(result.mineGatePrice);
    expect(result.fobPrice).toBeGreaterThan(result.mineGatePrice);
    expect(result.fcaPortPrice).toBeGreaterThan(result.mineGatePrice);
  });

  it('price levels follow correct order: mineGate < fcaPort < fob < cif', () => {
    const result = simulateDeal(BASE_PARAMS);
    expect(result.mineGatePrice).toBeLessThan(result.fcaPortPrice);
    expect(result.fcaPortPrice).toBeLessThan(result.fobPrice);
    expect(result.fobPrice).toBeLessThan(result.cifPrice);
  });

  it('calculates positive margin when index > delivered cost', () => {
    const result = simulateDeal({
      ...BASE_PARAMS,
      indexCifPrice: 300, // Well above expected CIF
    });
    expect(result.margin).not.toBeNull();
    expect(result.margin!).toBeGreaterThan(0);
    expect(result.marginPct!).toBeGreaterThan(0);
    expect(result.totalProfit!).toBeGreaterThan(0);
  });

  it('calculates negative margin when index < delivered cost', () => {
    const result = simulateDeal({
      ...BASE_PARAMS,
      indexCifPrice: 100, // Below mine gate price
    });
    expect(result.margin).not.toBeNull();
    expect(result.margin!).toBeLessThan(0);
    expect(result.totalProfit!).toBeLessThan(0);
  });

  it('calculates breakeven mine gate price correctly', () => {
    const indexPrice = 250;
    const result = simulateDeal({
      ...BASE_PARAMS,
      indexCifPrice: indexPrice,
    });
    expect(result.breakevenMineGate).not.toBeNull();
    // At breakeven mine gate price, margin should be ~0
    const breakevenResult = simulateDeal({
      ...BASE_PARAMS,
      mineGatePrice: result.breakevenMineGate!,
      indexCifPrice: indexPrice,
    });
    // Margin should be approximately zero (within rounding)
    expect(Math.abs(breakevenResult.margin!)).toBeLessThan(1);
  });

  it('includes financing costs when financing is provided', () => {
    const withoutFinancing = simulateDeal(BASE_PARAMS);
    const withFinancing = simulateDeal({
      ...BASE_PARAMS,
      financing: {
        lcCostPct: 1.0,
        interestRatePct: 11.5,
        creditInsurancePct: 0.5,
      },
    });
    expect(withFinancing.financing).not.toBeNull();
    expect(withFinancing.financing!.totalFinancingCost).toBeGreaterThan(0);
    expect(withFinancing.financing!.lcCost).toBeGreaterThan(0);
    expect(withFinancing.financing!.interestCost).toBeGreaterThan(0);
    expect(withFinancing.financing!.insuranceCost).toBeGreaterThan(0);
    expect(withFinancing.totalDeliveredCost).toBeGreaterThan(withoutFinancing.totalDeliveredCost);
  });

  it('estimates timeline correctly', () => {
    const result = simulateDeal(BASE_PARAMS);
    expect(result.estimatedDaysToDelivery).toBeGreaterThan(0);
    // Rail transport + port staging + ocean + discharge should be at least 13 days
    const minDays = STAGE_DURATIONS.mine_to_port_rail + STAGE_DURATIONS.port_staging + STAGE_DURATIONS.discharge_and_customs;
    expect(result.estimatedDaysToDelivery).toBeGreaterThanOrEqual(minDays);
  });

  it('road transport takes less inland time than rail', () => {
    const railResult = simulateDeal({ ...BASE_PARAMS, transportMode: 'rail' });
    const roadResult = simulateDeal({ ...BASE_PARAMS, transportMode: 'road' });
    // Road should have different timeline (road = 2 days inland vs rail = 3)
    expect(roadResult.estimatedDaysToDelivery).toBeLessThan(railResult.estimatedDaysToDelivery);
  });

  it('road transport costs more per tonne-km than rail', () => {
    const railResult = simulateDeal({ ...BASE_PARAMS, transportMode: 'rail' });
    const roadResult = simulateDeal({ ...BASE_PARAMS, transportMode: 'road' });
    // Road has higher per-tonne-km rate, so inland freight step should be larger
    const railInland = railResult.steps.find(s => s.label.includes('Inland rail'));
    const roadInland = roadResult.steps.find(s => s.label.includes('Inland road'));
    expect(railInland).toBeDefined();
    expect(roadInland).toBeDefined();
    expect(roadInland!.amount).toBeGreaterThan(railInland!.amount);
  });

  it('returns null margin when no index price provided', () => {
    const result = simulateDeal(BASE_PARAMS);
    expect(result.margin).toBeNull();
    expect(result.marginPct).toBeNull();
    expect(result.totalProfit).toBeNull();
    expect(result.breakevenMineGate).toBeNull();
  });

  it('includes port costs for Richards Bay', () => {
    const result = simulateDeal(BASE_PARAMS);
    const portSteps = result.steps.filter(s => s.category === 'port');
    expect(portSteps.length).toBeGreaterThanOrEqual(7); // stevedoring, crosshaul, handling, wharfage, agency, security, customs, surveyor
  });

  it('includes mineral royalty tax', () => {
    const result = simulateDeal(BASE_PARAMS);
    const royaltyStep = result.steps.find(s => s.label === 'Mineral royalty');
    expect(royaltyStep).toBeDefined();
    expect(royaltyStep!.amount).toBeGreaterThan(0);
    expect(royaltyStep!.category).toBe('tax');
  });

  it('skips inland transport when no mine coords provided', () => {
    const result = simulateDeal({
      ...BASE_PARAMS,
      mineCoords: undefined,
      mineName: undefined,
    });
    const inlandStep = result.steps.find(s => s.label.includes('Inland'));
    expect(inlandStep).toBeUndefined();
    // FCA Port should equal mine gate + weighbridge
    expect(result.fcaPortPrice).toBeCloseTo(BASE_PARAMS.mineGatePrice + 0.27, 1);
  });
});
