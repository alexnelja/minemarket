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
