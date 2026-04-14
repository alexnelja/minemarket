import { describe, it, expect } from 'vitest';
import { optimizeTransitRoutes, optimizeRoutes, LOADING_PORTS, COMMODITY_PORTS } from '../route-optimizer';
import type { RouteOptimizationResult, TransitRouteOption } from '../route-optimizer';

// Standard test params: Steelpoort Chrome → Qingdao
const baseParams = {
  commodity: 'chrome' as const,
  buyPrice: 151,
  volumeTonnes: 15000,
  originCoords: { lat: -24.69, lng: 30.19 },
  originName: 'Steelpoort Chrome',
  destinationCoords: { lat: 36.067, lng: 120.383 },
  destinationName: 'Qingdao, China',
  indexCifPrice: 280,
};

describe('optimizeTransitRoutes', () => {
  it('should return routes sorted by margin descending', () => {
    const result = optimizeTransitRoutes(baseParams);
    expect(result.routes.length).toBeGreaterThan(0);

    for (let i = 1; i < result.routes.length; i++) {
      expect(result.routes[i - 1].margin).toBeGreaterThanOrEqual(result.routes[i].margin);
    }
  });

  it('should assign sequential ranks starting at 1', () => {
    const result = optimizeTransitRoutes(baseParams);
    result.routes.forEach((route, i) => {
      expect(route.rank).toBe(i + 1);
    });
  });

  it('should have bestByMargin with highest margin', () => {
    const result = optimizeTransitRoutes(baseParams);
    expect(result.bestByMargin).not.toBeNull();
    if (result.bestByMargin && result.routes.length > 1) {
      expect(result.bestByMargin.margin).toBeGreaterThanOrEqual(result.routes[1].margin);
    }
  });

  it('should have bestBySpeed with lowest totalDays', () => {
    const result = optimizeTransitRoutes(baseParams);
    expect(result.bestBySpeed).not.toBeNull();
    if (result.bestBySpeed) {
      for (const route of result.routes) {
        expect(result.bestBySpeed.totalDays).toBeLessThanOrEqual(route.totalDays);
      }
    }
  });

  it('should have bestByFreight with lowest ocean freight', () => {
    const result = optimizeTransitRoutes(baseParams);
    expect(result.bestByFreight).not.toBeNull();
    if (result.bestByFreight) {
      for (const route of result.routes) {
        expect(result.bestByFreight.oceanFreight).toBeLessThanOrEqual(route.oceanFreight);
      }
    }
  });

  it('should filter ports by commodity', () => {
    const result = optimizeTransitRoutes(baseParams);
    const portNames = [...new Set(result.routes.map(r => r.transitPort))];
    const chromePorts = COMMODITY_PORTS['chrome'];
    portNames.forEach(name => {
      expect(chromePorts).toContain(name);
    });
  });

  it('should use different ports for manganese vs chrome', () => {
    const chromeResult = optimizeTransitRoutes(baseParams);
    const manganeseResult = optimizeTransitRoutes({
      ...baseParams,
      commodity: 'manganese',
      originCoords: { lat: -27.24, lng: 22.95 },
      originName: 'Hotazel Manganese',
    });

    const chromePorts = [...new Set(chromeResult.routes.map(r => r.transitPort))];
    const manganesePorts = [...new Set(manganeseResult.routes.map(r => r.transitPort))];

    // Manganese should include Saldanha Bay, which chrome should not
    expect(manganesePorts).toContain('Saldanha Bay');
    expect(chromePorts).not.toContain('Saldanha Bay');
  });

  it('should enumerate transit ports, not destinations', () => {
    const result = optimizeTransitRoutes(baseParams);
    // All routes should go to the same destination
    expect(result.destination).toBe('Qingdao, China');
    // But routes should be via different transit ports
    const ports = [...new Set(result.routes.map(r => r.transitPort))];
    expect(ports.length).toBeGreaterThan(1);
  });

  it('should include both rail and road for short-distance ports', () => {
    const result = optimizeTransitRoutes(baseParams);
    // Maputo is close (~380km) so should have road option
    const maputoModes = result.routes
      .filter(r => r.transitPort === 'Maputo')
      .map(r => r.transportMode);
    expect(maputoModes).toContain('rail');
    expect(maputoModes).toContain('road');
  });

  it('should have sell prices greater than buy price', () => {
    const result = optimizeTransitRoutes(baseParams);
    result.routes.forEach(route => {
      expect(route.sellPrice).toBeGreaterThan(result.buyPrice);
      expect(route.totalCostPerTonne).toBeGreaterThan(0);
    });
  });

  it('should populate cost breakdown fields', () => {
    const result = optimizeTransitRoutes(baseParams);
    result.routes.forEach(route => {
      expect(route.inlandCost).toBeGreaterThan(0);
      expect(route.inlandDistKm).toBeGreaterThan(0);
      expect(route.portCosts).toBeGreaterThan(0);
      expect(route.oceanFreight).toBeGreaterThan(0);
      expect(route.oceanDistNm).toBeGreaterThan(0);
      expect(route.totalDays).toBeGreaterThan(0);
    });
  });

  it('should populate route description strings', () => {
    const result = optimizeTransitRoutes(baseParams);
    result.routes.forEach(route => {
      expect(route.inlandRoute).toBeTruthy();
      expect(route.inlandRoute).toContain('km');
      expect(route.seaRoute).toBeTruthy();
      expect(route.seaRoute).toContain('nm');
    });
  });

  it('should use known SA rail routes when available', () => {
    const result = optimizeTransitRoutes(baseParams);
    // Steelpoort → Richards Bay has a known route of 620km
    const rbRail = result.routes.find(r => r.transitPort === 'Richards Bay' && r.transportMode === 'rail');
    expect(rbRail).toBeDefined();
    if (rbRail) {
      expect(rbRail.inlandDistKm).toBe(620);
    }
  });

  it('should include metadata matching input params', () => {
    const result = optimizeTransitRoutes(baseParams);
    expect(result.origin).toBe('Steelpoort Chrome');
    expect(result.destination).toBe('Qingdao, China');
    expect(result.commodity).toBe('chrome');
    expect(result.buyPrice).toBe(151);
    expect(result.volumeTonnes).toBe(15000);
    expect(result.indexPrice).toBe(280);
  });

  it('should include an optimizedAt timestamp', () => {
    const result = optimizeTransitRoutes(baseParams);
    expect(result.optimizedAt).toBeTruthy();
    expect(new Date(result.optimizedAt).getTime()).not.toBeNaN();
  });

  it('should return zero margins when no index price is given', () => {
    const result = optimizeTransitRoutes({
      ...baseParams,
      indexCifPrice: undefined,
    });
    // Routes should still be returned (with 0 margin)
    expect(result.routes.length).toBeGreaterThan(0);
    expect(result.indexPrice).toBeNull();
    result.routes.forEach(route => {
      expect(route.margin).toBe(0);
    });
  });
});

// ── FOB sell point tests ─────────────────────────────────────────────────────

const fobParams = {
  ...baseParams,
  sellPoint: 'fob' as const,
};

describe('optimizeTransitRoutes (FOB sell point)', () => {
  it('should return routes with zero ocean freight', () => {
    const result = optimizeTransitRoutes(fobParams);
    expect(result.routes.length).toBeGreaterThan(0);
    result.routes.forEach(route => {
      expect(route.oceanFreight).toBe(0);
      expect(route.oceanDistNm).toBe(0);
      expect(route.oceanDays).toBe(0);
    });
  });

  it('should set destination to "FOB at best port"', () => {
    const result = optimizeTransitRoutes(fobParams);
    expect(result.destination).toBe('FOB at best port');
  });

  it('should still have positive inland and port costs', () => {
    const result = optimizeTransitRoutes(fobParams);
    result.routes.forEach(route => {
      expect(route.inlandCost).toBeGreaterThan(0);
      expect(route.portCosts).toBeGreaterThan(0);
      expect(route.inlandDistKm).toBeGreaterThan(0);
    });
  });

  it('should have lower totalCostPerTonne than CIF for same params', () => {
    const cifResult = optimizeTransitRoutes(baseParams);
    const fobResult = optimizeTransitRoutes(fobParams);

    // For the same port, FOB cost should be lower (no ocean freight, discharge, insurance)
    const cifRb = cifResult.routes.find(r => r.transitPort === 'Richards Bay' && r.transportMode === 'rail');
    const fobRb = fobResult.routes.find(r => r.transitPort === 'Richards Bay' && r.transportMode === 'rail');

    expect(cifRb).toBeDefined();
    expect(fobRb).toBeDefined();
    if (cifRb && fobRb) {
      expect(fobRb.totalCostPerTonne).toBeLessThan(cifRb.totalCostPerTonne);
      expect(fobRb.oceanFreight).toBe(0);
      expect(cifRb.oceanFreight).toBeGreaterThan(0);
    }
  });

  it('should have higher margins than CIF when using same index price', () => {
    const cifResult = optimizeTransitRoutes(baseParams);
    const fobResult = optimizeTransitRoutes(fobParams);

    // FOB has no ocean/discharge/insurance costs → higher margin
    if (cifResult.bestByMargin && fobResult.bestByMargin) {
      expect(fobResult.bestByMargin.margin).toBeGreaterThan(cifResult.bestByMargin.margin);
    }
  });

  it('should not include discharge fees', () => {
    // Compare two routes at the same port — the difference should NOT include $4.50 discharge
    const fobResult = optimizeTransitRoutes(fobParams);
    const cfr = optimizeTransitRoutes({ ...fobParams, sellPoint: 'cfr' });

    const fobRb = fobResult.routes.find(r => r.transitPort === 'Richards Bay' && r.transportMode === 'rail');
    const cfrRb = cfr.routes.find(r => r.transitPort === 'Richards Bay' && r.transportMode === 'rail');

    if (fobRb && cfrRb) {
      // CFR has ocean freight + discharge, FOB has neither
      const costDiff = cfrRb.totalCostPerTonne - fobRb.totalCostPerTonne;
      expect(costDiff).toBeGreaterThan(0);
      // Diff should include ocean freight + discharge fees ($4.50)
      expect(costDiff).toBeGreaterThan(4.50);
    }
  });

  it('should have empty seaRoute description', () => {
    const result = optimizeTransitRoutes(fobParams);
    result.routes.forEach(route => {
      expect(route.seaRoute).toBe('');
    });
  });

  it('should have bestByFreight pick lowest totalCostPerTonne (not ocean freight)', () => {
    const result = optimizeTransitRoutes(fobParams);
    expect(result.bestByFreight).not.toBeNull();
    if (result.bestByFreight) {
      for (const route of result.routes) {
        expect(result.bestByFreight.totalCostPerTonne).toBeLessThanOrEqual(route.totalCostPerTonne);
      }
    }
  });

  it('should sort routes by margin descending', () => {
    const result = optimizeTransitRoutes(fobParams);
    for (let i = 1; i < result.routes.length; i++) {
      expect(result.routes[i - 1].margin).toBeGreaterThanOrEqual(result.routes[i].margin);
    }
  });

  it('should still filter ports by commodity', () => {
    const result = optimizeTransitRoutes(fobParams);
    const portNames = [...new Set(result.routes.map(r => r.transitPort))];
    const chromePorts = COMMODITY_PORTS['chrome'];
    portNames.forEach(name => {
      expect(chromePorts).toContain(name);
    });
  });

  it('should work with port_gate sell point too', () => {
    const result = optimizeTransitRoutes({ ...baseParams, sellPoint: 'port_gate' });
    expect(result.routes.length).toBeGreaterThan(0);
    expect(result.destination).toBe('FOB at best port');
    result.routes.forEach(route => {
      expect(route.oceanFreight).toBe(0);
    });
  });

  it('should work with no index price (zero margins)', () => {
    const result = optimizeTransitRoutes({
      ...fobParams,
      indexCifPrice: undefined,
    });
    expect(result.routes.length).toBeGreaterThan(0);
    result.routes.forEach(route => {
      expect(route.margin).toBe(0);
      expect(route.oceanFreight).toBe(0);
    });
  });
});

// ── CFR sell point tests ────────────────────────────────────────────────────

describe('optimizeTransitRoutes (CFR sell point)', () => {
  it('should include ocean freight but zero insurance', () => {
    const result = optimizeTransitRoutes({ ...baseParams, sellPoint: 'cfr' });
    expect(result.routes.length).toBeGreaterThan(0);
    result.routes.forEach(route => {
      expect(route.oceanFreight).toBeGreaterThan(0);
    });
    // CFR total should be less than CIF (no insurance)
    const cifResult = optimizeTransitRoutes(baseParams);
    const cfrRb = result.routes.find(r => r.transitPort === 'Richards Bay' && r.transportMode === 'rail');
    const cifRb = cifResult.routes.find(r => r.transitPort === 'Richards Bay' && r.transportMode === 'rail');
    if (cfrRb && cifRb) {
      expect(cfrRb.totalCostPerTonne).toBeLessThan(cifRb.totalCostPerTonne);
    }
  });

  it('should show destination name (not FOB label)', () => {
    const result = optimizeTransitRoutes({ ...baseParams, sellPoint: 'cfr' });
    expect(result.destination).toBe('Qingdao, China');
  });
});

// ── Edge cases ──────────────────────────────────────────────────────────────

describe('optimizeTransitRoutes (edge cases)', () => {
  it('should handle unknown commodity gracefully (uses all ports)', () => {
    const result = optimizeTransitRoutes({
      ...baseParams,
      commodity: 'unknown_commodity' as any,
    });
    // Falls back to all loading ports
    expect(result.routes.length).toBeGreaterThan(0);
  });

  it('should handle very small volume', () => {
    const result = optimizeTransitRoutes({
      ...baseParams,
      volumeTonnes: 100,
    });
    expect(result.routes.length).toBeGreaterThan(0);
    result.routes.forEach(route => {
      expect(route.totalCostPerTonne).toBeGreaterThan(0);
    });
  });

  it('should handle very large volume', () => {
    const result = optimizeTransitRoutes({
      ...baseParams,
      volumeTonnes: 200000,
    });
    expect(result.routes.length).toBeGreaterThan(0);
  });

  it('should have CIF insurance > 0 on every CIF route', () => {
    const result = optimizeTransitRoutes(baseParams);
    // CIF total = subtotal + insurance. Insurance > 0 means CIF total > CFR total.
    const cfrResult = optimizeTransitRoutes({ ...baseParams, sellPoint: 'cfr' });
    // At least one port should show difference
    const cifRb = result.routes.find(r => r.transitPort === 'Richards Bay' && r.transportMode === 'rail');
    const cfrRb = cfrResult.routes.find(r => r.transitPort === 'Richards Bay' && r.transportMode === 'rail');
    if (cifRb && cfrRb) {
      expect(cifRb.totalCostPerTonne).toBeGreaterThan(cfrRb.totalCostPerTonne);
    }
  });
});

// Test backward-compatible wrapper
describe('optimizeRoutes (legacy wrapper)', () => {
  it('should still work with old interface', () => {
    const result = optimizeRoutes({
      commodity: 'chrome',
      buyPoint: 'mine_gate',
      sellPoint: 'cif',
      buyPrice: 151,
      volumeTonnes: 15000,
      indexCifPrice: 280,
    });
    expect(result.routes.length).toBeGreaterThan(0);
    expect(result.commodity).toBe('chrome');
    expect(result.optimizedAt).toBeTruthy();
  });

  it('should accept mineCoords and mineName', () => {
    const result = optimizeRoutes({
      commodity: 'chrome',
      buyPoint: 'mine_gate',
      sellPoint: 'cif',
      buyPrice: 151,
      volumeTonnes: 15000,
      mineCoords: { lat: -24.69, lng: 30.19 },
      mineName: 'Steelpoort Chrome',
      indexCifPrice: 280,
    });
    expect(result.origin).toBe('Steelpoort Chrome');
    expect(result.routes.length).toBeGreaterThan(0);
  });
});

// ── Chrome corridor improvements ────────────────────────────────────────────

describe('chrome corridor improvements', () => {
  it('should include road-to-Maputo option for chrome (>500km)', () => {
    const result = optimizeTransitRoutes(baseParams);
    const maputoRoad = result.routes.find(r => r.transitPort === 'Maputo' && r.transportMode === 'road');
    expect(maputoRoad).toBeDefined();
    // Maputo is ~380-650km from Bushveld — road should be allowed for chrome
  });

  it('should have higher road cost than rail for chrome to Maputo', () => {
    const result = optimizeTransitRoutes(baseParams);
    const maputoRail = result.routes.find(r => r.transitPort === 'Maputo' && r.transportMode === 'rail');
    const maputoRoad = result.routes.find(r => r.transitPort === 'Maputo' && r.transportMode === 'road');
    if (maputoRail && maputoRoad) {
      expect(maputoRoad.inlandCost).toBeGreaterThan(maputoRail.inlandCost);
    }
  });

  it('should NOT include road-to-Maputo for iron ore (default 500km limit)', () => {
    const result = optimizeTransitRoutes({
      ...baseParams,
      commodity: 'iron_ore',
      originCoords: { lat: -27.74, lng: 22.98 }, // Sishen
      originName: 'Sishen Iron Ore',
    });
    // Sishen is ~1400km from Maputo — way beyond any road limit
    const maputoRoad = result.routes.find(r => r.transitPort === 'Maputo' && r.transportMode === 'road');
    expect(maputoRoad).toBeUndefined();
  });
});

// ── Ngqura port for manganese ───────────────────────────────────────────────

describe('Ngqura port for manganese', () => {
  const mnParams = {
    ...baseParams,
    commodity: 'manganese' as const,
    originCoords: { lat: -27.24, lng: 22.95 },
    originName: 'Hotazel Manganese',
  };

  it('should include Ngqura as a port option for manganese', () => {
    const result = optimizeTransitRoutes(mnParams);
    const ngqura = result.routes.find(r => r.transitPort === 'Ngqura');
    expect(ngqura).toBeDefined();
  });

  it('should have lower port costs at Ngqura than at Maputo', () => {
    const result = optimizeTransitRoutes(mnParams);
    const ngqura = result.routes.find(r => r.transitPort === 'Ngqura' && r.transportMode === 'rail');
    const maputo = result.routes.find(r => r.transitPort === 'Maputo' && r.transportMode === 'rail');
    // Ngqura is purpose-built, Maputo charges premium
    if (ngqura && maputo) {
      expect(ngqura.portCosts).toBeLessThan(maputo.portCosts);
    }
  });

  it('should include road option for manganese to Ngqura (overflow corridor)', () => {
    const result = optimizeTransitRoutes(mnParams);
    const ngquraRoad = result.routes.find(r => r.transitPort === 'Ngqura' && r.transportMode === 'road');
    expect(ngquraRoad).toBeDefined();
    // ~1050km by road — allowed because manganese ROAD_MAX_KM is 1100
  });
});

// ── Grade adjustment ────────────────────────────────────────────────────────

describe('grade adjustment', () => {
  it('should reduce margin for lower-grade chrome', () => {
    const highGrade = optimizeTransitRoutes({ ...baseParams, grade: 42 });
    const lowGrade = optimizeTransitRoutes({ ...baseParams, grade: 36 });

    if (highGrade.bestByMargin && lowGrade.bestByMargin) {
      // Lower grade → lower index value → lower margin
      expect(lowGrade.bestByMargin.margin).toBeLessThan(highGrade.bestByMargin.margin);
    }
  });

  it('should not adjust margin when no grade is provided', () => {
    const withGrade = optimizeTransitRoutes({ ...baseParams, grade: 42 }); // reference grade
    const noGrade = optimizeTransitRoutes({ ...baseParams }); // no grade

    if (withGrade.bestByMargin && noGrade.bestByMargin) {
      // grade=42 is the reference, so should be identical to no-grade
      expect(withGrade.bestByMargin.margin).toBe(noGrade.bestByMargin.margin);
    }
  });

  it('should increase margin for higher-grade manganese', () => {
    const mnParams = {
      ...baseParams,
      commodity: 'manganese' as const,
      originCoords: { lat: -27.24, lng: 22.95 },
      originName: 'Hotazel Manganese',
    };
    const standard = optimizeTransitRoutes({ ...mnParams, grade: 37 });
    const premium = optimizeTransitRoutes({ ...mnParams, grade: 44 });

    if (standard.bestByMargin && premium.bestByMargin) {
      expect(premium.bestByMargin.margin).toBeGreaterThan(standard.bestByMargin.margin);
    }
  });
});
