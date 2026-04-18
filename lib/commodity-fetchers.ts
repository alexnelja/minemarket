/**
 * Pure parsers for external commodity-price feeds. The network fetch lives in
 * the cron route; everything in here is deterministic and testable without
 * hitting the wire.
 */

export interface DailyPrice {
  date: string; // ISO YYYY-MM-DD (UTC)
  price: number;
}

/**
 * Yahoo Finance chart API shape: `/v8/finance/chart/<symbol>?interval=1d`.
 * Returns pairs of (timestamp, close), dropping any point where the close is
 * null/NaN/non-finite (Yahoo emits nulls on half-trading days).
 */
export function parseYahooChartResponse(raw: unknown): DailyPrice[] {
  if (!raw || typeof raw !== 'object') return [];
  const chart = (raw as { chart?: unknown }).chart;
  if (!chart || typeof chart !== 'object') return [];
  const result = (chart as { result?: unknown[] }).result;
  if (!Array.isArray(result) || result.length === 0) return [];

  const first = result[0] as {
    timestamp?: unknown;
    indicators?: { quote?: Array<{ close?: unknown }> };
  };
  const timestamps = first.timestamp;
  const closes = first.indicators?.quote?.[0]?.close;
  if (!Array.isArray(timestamps) || !Array.isArray(closes)) return [];
  if (timestamps.length !== closes.length) return [];

  const out: DailyPrice[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const ts = timestamps[i];
    const close = closes[i];
    if (typeof ts !== 'number') continue;
    if (typeof close !== 'number' || !Number.isFinite(close)) continue;
    const date = new Date(ts * 1000).toISOString().slice(0, 10);
    out.push({ date, price: close });
  }
  return out;
}
