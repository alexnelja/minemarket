import { describe, it, expect } from 'vitest';
import { parseYahooChartResponse } from '../commodity-fetchers';

describe('parseYahooChartResponse', () => {
  it('pairs timestamps with closes and drops null closes', () => {
    const raw = {
      chart: {
        result: [{
          meta: { currency: 'USD', symbol: 'HG=F' },
          timestamp: [1704067200, 1704153600, 1704240000],
          indicators: { quote: [{ close: [3.85, null, 3.92] }] },
        }],
      },
    };
    expect(parseYahooChartResponse(raw)).toEqual([
      { date: '2024-01-01', price: 3.85 },
      { date: '2024-01-03', price: 3.92 },
    ]);
  });

  it('returns empty array for missing result', () => {
    expect(parseYahooChartResponse({ chart: { result: [] } })).toEqual([]);
    expect(parseYahooChartResponse({ chart: {} })).toEqual([]);
    expect(parseYahooChartResponse({})).toEqual([]);
    expect(parseYahooChartResponse(null)).toEqual([]);
  });

  it('returns empty array when timestamp/close arrays are mismatched lengths', () => {
    const raw = {
      chart: {
        result: [{
          timestamp: [1, 2, 3],
          indicators: { quote: [{ close: [1.0, 2.0] }] },
        }],
      },
    };
    expect(parseYahooChartResponse(raw)).toEqual([]);
  });

  it('drops entries where close is not a finite number', () => {
    const raw = {
      chart: {
        result: [{
          timestamp: [1704067200, 1704153600, 1704240000, 1704326400],
          indicators: { quote: [{ close: [3.85, NaN, Infinity, 3.90] }] },
        }],
      },
    };
    expect(parseYahooChartResponse(raw)).toEqual([
      { date: '2024-01-01', price: 3.85 },
      { date: '2024-01-04', price: 3.90 },
    ]);
  });

  it('returns empty array when indicators.quote[0].close is missing', () => {
    const raw = {
      chart: {
        result: [{
          timestamp: [1704067200],
          indicators: { quote: [{}] },
        }],
      },
    };
    expect(parseYahooChartResponse(raw)).toEqual([]);
  });

  it('does not crash on arbitrary malformed input', () => {
    expect(parseYahooChartResponse('not an object')).toEqual([]);
    expect(parseYahooChartResponse(undefined)).toEqual([]);
    expect(parseYahooChartResponse(42)).toEqual([]);
    expect(parseYahooChartResponse([])).toEqual([]);
  });
});
