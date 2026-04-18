import { describe, it, expect } from 'vitest';
import { buildTermSheetData } from '../term-sheet-data';

const baseDeal = {
  id: 'c75f690b-1234-5678-9012-345678901234',
  commodity_type: 'chrome' as const,
  commodity_subtype: 'cr_42' as const satisfies string | null,
  volume_tonnes: 5000,
  agreed_price: 220,
  currency: 'USD' as const,
  incoterm: 'FOB',
  spec_tolerances: { cr2o3_pct: { min: 42 } },
  price_adjustment_rules: {},
  created_at: '2026-03-01T12:00:00Z',
  second_accept_at: '2026-03-02T09:00:00Z',
};

const parties = {
  buyer: { id: 'buyer-1', name: 'Acme Trading Ltd', email: 'buyer@acme.example' },
  seller: { id: 'seller-1', name: 'KZN Mining Co', email: 'seller@kzn.example' },
};

describe('buildTermSheetData', () => {
  it('produces a title that identifies commodity + short deal id', () => {
    const data = buildTermSheetData(baseDeal, parties);
    expect(data.title).toContain('Chrome');
    expect(data.title).toContain('c75f690b');
  });

  it('includes parties with name and email', () => {
    const data = buildTermSheetData(baseDeal, parties);
    expect(data.parties.buyer).toEqual({ name: 'Acme Trading Ltd', email: 'buyer@acme.example' });
    expect(data.parties.seller).toEqual({ name: 'KZN Mining Co', email: 'seller@kzn.example' });
  });

  it('computes total contract value as volume × price', () => {
    const data = buildTermSheetData(baseDeal, parties);
    expect(data.commercials.total_value_usd).toBe(5000 * 220);
    expect(data.commercials.unit_price_usd).toBe(220);
    expect(data.commercials.volume_tonnes).toBe(5000);
    expect(data.commercials.incoterm).toBe('FOB');
  });

  it('formats spec rows with minimum thresholds and a readable label', () => {
    const data = buildTermSheetData(baseDeal, parties);
    const row = data.spec_rows.find(r => r.key === 'cr2o3_pct');
    expect(row).toBeDefined();
    expect(row!.label.toLowerCase()).toContain('cr');
    expect(row!.constraint).toMatch(/≥|min/i);
  });

  it('falls back to "—" on missing party names', () => {
    const data = buildTermSheetData(baseDeal, {
      buyer: { id: 'buyer-1', name: '', email: 'buyer@acme.example' },
      seller: { id: 'seller-1', name: '', email: 'seller@kzn.example' },
    });
    expect(data.parties.buyer.name).toBe('—');
    expect(data.parties.seller.name).toBe('—');
  });

  it('uses second_accept_at as effective date when present, else created_at', () => {
    const acceptedOnly = buildTermSheetData(baseDeal, parties);
    expect(acceptedOnly.dates.effective_date).toBe('2026-03-02');

    const notYetAccepted = buildTermSheetData(
      { ...baseDeal, second_accept_at: null },
      parties,
    );
    expect(notYetAccepted.dates.effective_date).toBe('2026-03-01');
  });

  it('returns empty spec_rows when spec_tolerances is missing or empty', () => {
    const empty = buildTermSheetData({ ...baseDeal, spec_tolerances: {} }, parties);
    expect(empty.spec_rows).toEqual([]);
  });

  it('handles max-only and range constraints', () => {
    const data = buildTermSheetData({
      ...baseDeal,
      spec_tolerances: {
        si_pct: { max: 6 },
        fe_pct: { min: 22, max: 28 },
      },
    }, parties);
    const si = data.spec_rows.find(r => r.key === 'si_pct');
    const fe = data.spec_rows.find(r => r.key === 'fe_pct');
    expect(si!.constraint).toMatch(/≤|max/i);
    expect(fe!.constraint).toMatch(/22.*28|22-28/);
  });
});
