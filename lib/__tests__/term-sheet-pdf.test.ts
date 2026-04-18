import { describe, it, expect } from 'vitest';
import { renderTermSheetPdf } from '../term-sheet-pdf';
import { buildTermSheetData } from '../term-sheet-data';

describe('renderTermSheetPdf (smoke)', () => {
  it('produces a non-empty PDF buffer with a valid %PDF- header', async () => {
    const data = buildTermSheetData({
      id: 'c75f690b-1234-5678-9012-345678901234',
      commodity_type: 'chrome',
      commodity_subtype: 'cr_42',
      volume_tonnes: 5000,
      agreed_price: 220,
      currency: 'USD',
      incoterm: 'FOB',
      spec_tolerances: { cr2o3_pct: { min: 42 }, fe_pct: { min: 22, max: 28 } },
      price_adjustment_rules: {},
      created_at: '2026-03-01T12:00:00Z',
      second_accept_at: '2026-03-02T09:00:00Z',
    }, {
      buyer: { id: 'b', name: 'Acme Trading', email: 'b@a.example' },
      seller: { id: 's', name: 'KZN Mining', email: 's@k.example' },
    });

    const pdf = await renderTermSheetPdf(data);
    expect(pdf.length).toBeGreaterThan(500);
    expect(pdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  }, 15000);
});
