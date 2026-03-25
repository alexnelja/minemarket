import { describe, it, expect, vi, afterEach } from 'vitest';
import { timeAgo, formatCurrency, formatTonnes, formatPctChange } from '../format';

describe('timeAgo', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns seconds ago for recent timestamps', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const thirtySecsAgo = new Date(now - 30_000).toISOString();
    expect(timeAgo(thirtySecsAgo)).toBe('30s ago');
  });

  it('returns minutes ago', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const fiveMinAgo = new Date(now - 5 * 60_000).toISOString();
    expect(timeAgo(fiveMinAgo)).toBe('5m ago');
  });

  it('returns hours ago', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const threeHrsAgo = new Date(now - 3 * 3_600_000).toISOString();
    expect(timeAgo(threeHrsAgo)).toBe('3h ago');
  });

  it('returns days ago', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const twoDaysAgo = new Date(now - 2 * 86_400_000).toISOString();
    expect(timeAgo(twoDaysAgo)).toBe('2d ago');
  });
});

describe('formatCurrency', () => {
  it('formats USD', () => {
    const result = formatCurrency(1234567, 'USD');
    expect(result).toContain('$');
    expect(result).toContain('1,234,567');
  });

  it('formats ZAR', () => {
    const result = formatCurrency(50000, 'ZAR');
    expect(result).toContain('ZAR');
    expect(result).toContain('50,000');
  });

  it('formats EUR', () => {
    const result = formatCurrency(9999.99, 'EUR');
    expect(result).toContain('€');
  });

  it('handles decimal amounts', () => {
    const result = formatCurrency(1234.56, 'USD');
    expect(result).toContain('1,234.56');
  });
});

describe('formatTonnes', () => {
  it('formats small amounts with t suffix', () => {
    expect(formatTonnes(500)).toBe('500t');
  });

  it('formats thousands with kt suffix', () => {
    expect(formatTonnes(1500)).toBe('1.5kt');
  });

  it('formats millions with Mt suffix', () => {
    expect(formatTonnes(2_500_000)).toBe('2.5Mt');
  });

  it('formats exact 1000 as kt', () => {
    expect(formatTonnes(1000)).toBe('1.0kt');
  });

  it('formats exact 1_000_000 as Mt', () => {
    expect(formatTonnes(1_000_000)).toBe('1.0Mt');
  });
});

describe('formatPctChange', () => {
  it('returns positive change', () => {
    const result = formatPctChange(150, 100);
    expect(result.text).toBe('+50.0%');
    expect(result.positive).toBe(true);
  });

  it('returns negative change', () => {
    const result = formatPctChange(50, 100);
    expect(result.text).toBe('-50.0%');
    expect(result.positive).toBe(false);
  });

  it('returns dash when previous is zero', () => {
    const result = formatPctChange(100, 0);
    expect(result.text).toBe('—');
    expect(result.positive).toBe(true);
  });

  it('returns +0.0% when current equals previous', () => {
    const result = formatPctChange(100, 100);
    expect(result.text).toBe('+0.0%');
    expect(result.positive).toBe(true);
  });
});
