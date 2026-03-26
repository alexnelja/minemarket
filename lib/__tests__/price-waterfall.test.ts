import { describe, it, expect } from 'vitest';
import {
  calculatePriceWaterfall,
  ROYALTY_RATES,
  PORT_CHARGES,
  INLAND_RATES,
  INSURANCE_RATE,
  SURVEY_SAMPLING_PER_TONNE,
  WEIGHBRIDGE_PER_TONNE,
} from '../price-waterfall';
import type { WaterfallParams } from '../price-waterfall';

const BASE_PARAMS: WaterfallParams = {
  cifPrice: 200,
  commodity: 'chrome',
  volumeTonnes: 50000,
  loadingPort: 'Richards Bay',
  loadingPortCoords: { lat: -28.801, lng: 32.038 },
  destinationCoords: { lat: 36.067, lng: 120.383 }, // Qingdao
};

describe('calculatePriceWaterfall', () => {
  it('returns descending price levels: CIF > FOB > FCA Port > FCA Mine Gate', () => {
    const result = calculatePriceWaterfall(BASE_PARAMS);
    expect(result.cifPrice).toBeGreaterThan(result.fobPrice);
    expect(result.fobPrice).toBeGreaterThan(result.fcaPortPrice);
    // Without mine coords, FCA Mine Gate equals FCA Port
    expect(result.fcaMineGatePrice).toBe(result.fcaPortPrice);
  });

  it('returns descending prices when mine coords are provided', () => {
    const result = calculatePriceWaterfall({
      ...BASE_PARAMS,
      mineCoords: { lat: -25.5, lng: 29.5 }, // Limpopo mine
      mineName: 'Test Mine',
    });
    expect(result.cifPrice).toBeGreaterThan(result.fobPrice);
    expect(result.fobPrice).toBeGreaterThan(result.fcaPortPrice);
    expect(result.fcaPortPrice).toBeGreaterThan(result.fcaMineGatePrice);
  });

  it('all steps have valid numeric amounts and subtotals', () => {
    const result = calculatePriceWaterfall(BASE_PARAMS);
    for (const step of result.steps) {
      expect(typeof step.amount).toBe('number');
      expect(typeof step.subtotal).toBe('number');
      expect(isNaN(step.amount)).toBe(false);
      expect(isNaN(step.subtotal)).toBe(false);
    }
  });

  it('first step is the CIF price', () => {
    const result = calculatePriceWaterfall(BASE_PARAMS);
    expect(result.steps[0].label).toContain('CIF');
    expect(result.steps[0].amount).toBe(BASE_PARAMS.cifPrice);
    expect(result.steps[0].subtotal).toBe(BASE_PARAMS.cifPrice);
  });

  it('currency is USD', () => {
    const result = calculatePriceWaterfall(BASE_PARAMS);
    expect(result.currency).toBe('USD');
  });
});

describe('royalty rate lookup', () => {
  it('returns correct rate for chrome', () => {
    expect(ROYALTY_RATES.chrome).toBe(0.03);
  });

  it('returns correct rate for iron_ore', () => {
    expect(ROYALTY_RATES.iron_ore).toBe(0.04);
  });

  it('returns correct rate for coal', () => {
    expect(ROYALTY_RATES.coal).toBe(0.02);
  });

  it('returns correct rate for platinum', () => {
    expect(ROYALTY_RATES.platinum).toBe(0.05);
  });

  it('has rates for all expected commodities', () => {
    const expected = ['chrome', 'manganese', 'iron_ore', 'coal', 'aggregates', 'platinum', 'gold', 'copper', 'vanadium', 'titanium'];
    for (const c of expected) {
      expect(ROYALTY_RATES[c]).toBeDefined();
      expect(ROYALTY_RATES[c]).toBeGreaterThan(0);
      expect(ROYALTY_RATES[c]).toBeLessThanOrEqual(0.07);
    }
  });
});

describe('port charges lookup', () => {
  it('returns charges for Richards Bay', () => {
    const charges = PORT_CHARGES['Richards Bay'];
    expect(charges).toBeDefined();
    expect(charges.handling).toBe(4.00);
    expect(charges.wharfage).toBe(1.20);
    expect(charges.storage_per_week).toBe(1.80);
  });

  it('returns charges for Saldanha Bay', () => {
    const charges = PORT_CHARGES['Saldanha Bay'];
    expect(charges).toBeDefined();
    expect(charges.handling).toBe(3.80);
  });

  it('has a default entry', () => {
    expect(PORT_CHARGES.default).toBeDefined();
    expect(PORT_CHARGES.default.handling).toBeGreaterThan(0);
  });

  it('uses default for unknown ports', () => {
    const result = calculatePriceWaterfall({
      ...BASE_PARAMS,
      loadingPort: 'Unknown Port',
    });
    const handlingStep = result.steps.find(s => s.label === 'Port handling');
    expect(handlingStep).toBeDefined();
    expect(handlingStep!.amount).toBe(-PORT_CHARGES.default.handling);
  });
});

describe('with mine coordinates', () => {
  it('includes inland freight step', () => {
    const result = calculatePriceWaterfall({
      ...BASE_PARAMS,
      mineCoords: { lat: -25.5, lng: 29.5 },
      mineName: 'Limpopo Chrome Mine',
      transportMode: 'rail',
    });
    const inlandStep = result.steps.find(s => s.label.includes('Inland'));
    expect(inlandStep).toBeDefined();
    expect(inlandStep!.amount).toBeLessThan(0);
    expect(inlandStep!.note).toContain('Limpopo Chrome Mine');
  });

  it('includes weighbridge step', () => {
    const result = calculatePriceWaterfall({
      ...BASE_PARAMS,
      mineCoords: { lat: -25.5, lng: 29.5 },
    });
    const wbStep = result.steps.find(s => s.label === 'Weighbridge');
    expect(wbStep).toBeDefined();
    expect(wbStep!.amount).toBe(-WEIGHBRIDGE_PER_TONNE);
  });

  it('road transport is more expensive than rail', () => {
    const mineCoords = { lat: -25.5, lng: 29.5 };
    const railResult = calculatePriceWaterfall({
      ...BASE_PARAMS,
      mineCoords,
      transportMode: 'rail',
    });
    const roadResult = calculatePriceWaterfall({
      ...BASE_PARAMS,
      mineCoords,
      transportMode: 'road',
    });
    // Road should yield a lower mine gate price (more deducted)
    expect(roadResult.fcaMineGatePrice).toBeLessThan(railResult.fcaMineGatePrice);
  });
});

describe('without mine coordinates', () => {
  it('does not include inland freight or weighbridge', () => {
    const result = calculatePriceWaterfall(BASE_PARAMS);
    const inlandStep = result.steps.find(s => s.label.includes('Inland'));
    const wbStep = result.steps.find(s => s.label === 'Weighbridge');
    expect(inlandStep).toBeUndefined();
    expect(wbStep).toBeUndefined();
  });

  it('FCA Mine Gate equals FCA Port', () => {
    const result = calculatePriceWaterfall(BASE_PARAMS);
    expect(result.fcaMineGatePrice).toBe(result.fcaPortPrice);
  });
});

describe('production cost and margin', () => {
  it('calculates positive margin when mine gate price exceeds production cost', () => {
    const result = calculatePriceWaterfall({
      ...BASE_PARAMS,
      productionCost: 50,
    });
    expect(result.margin).toBeDefined();
    expect(result.margin!.amount).toBeGreaterThan(0);
    expect(result.margin!.percentage).toBeGreaterThan(0);
  });

  it('calculates negative margin when production cost exceeds mine gate price', () => {
    const result = calculatePriceWaterfall({
      ...BASE_PARAMS,
      cifPrice: 60,
      productionCost: 100,
    });
    expect(result.margin).toBeDefined();
    expect(result.margin!.amount).toBeLessThan(0);
  });

  it('does not include margin when no production cost provided', () => {
    const result = calculatePriceWaterfall(BASE_PARAMS);
    expect(result.margin).toBeUndefined();
  });

  it('includes production cost and margin steps', () => {
    const result = calculatePriceWaterfall({
      ...BASE_PARAMS,
      productionCost: 50,
    });
    const costStep = result.steps.find(s => s.label === 'Production cost');
    const marginStep = result.steps.find(s => s.label === '= Margin');
    expect(costStep).toBeDefined();
    expect(marginStep).toBeDefined();
    expect(costStep!.amount).toBe(-50);
  });
});

describe('storage days', () => {
  it('includes terminal storage step when storageDays > 0', () => {
    const result = calculatePriceWaterfall({
      ...BASE_PARAMS,
      storageDays: 14,
    });
    const storageStep = result.steps.find(s => s.label === 'Terminal storage');
    expect(storageStep).toBeDefined();
    expect(storageStep!.amount).toBeLessThan(0);
    expect(storageStep!.note).toContain('14 days');
  });

  it('does not include storage when storageDays is 0', () => {
    const result = calculatePriceWaterfall(BASE_PARAMS);
    const storageStep = result.steps.find(s => s.label === 'Terminal storage');
    expect(storageStep).toBeUndefined();
  });
});

describe('constants', () => {
  it('INSURANCE_RATE is 0.15%', () => {
    expect(INSURANCE_RATE).toBe(0.0015);
  });

  it('SURVEY_SAMPLING_PER_TONNE is $0.70', () => {
    expect(SURVEY_SAMPLING_PER_TONNE).toBe(0.70);
  });

  it('WEIGHBRIDGE_PER_TONNE is $0.27', () => {
    expect(WEIGHBRIDGE_PER_TONNE).toBe(0.27);
  });

  it('rail rate is cheaper per km than road', () => {
    expect(INLAND_RATES.rail.perTonneKm).toBeLessThan(INLAND_RATES.road.perTonneKm);
  });
});
