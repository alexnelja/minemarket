import { describe, it, expect } from 'vitest';
import { buildLabNotificationEmail } from '../lab-notification-email';
import type { LabSummary } from '../lab-summary';

const baseDeal = {
  id: 'abcdef1234567890',
  commodityType: 'chrome',
  volumeTonnes: 15000,
};

const baseSummary: LabSummary = {
  headline: '4/4 fields within spec',
  tone: 'ok',
  adjustmentLabel: null,
};

describe('buildLabNotificationEmail', () => {
  it('includes deal ref (first 8 chars) in subject', () => {
    const { subject } = buildLabNotificationEmail({
      deal: baseDeal,
      inspectorCompany: 'SGS',
      labSummary: baseSummary,
      appUrl: 'https://app.example',
    });
    expect(subject).toContain('abcdef12');
    expect(subject).not.toContain('abcdef1234567890');
  });

  it('puts REJECTED in subject when tone is reject', () => {
    const rejected: LabSummary = {
      headline: 'Rejected — cr2o3_pct outside tolerance',
      tone: 'reject',
      adjustmentLabel: null,
    };
    const { subject } = buildLabNotificationEmail({
      deal: baseDeal,
      inspectorCompany: 'Bureau Veritas',
      labSummary: rejected,
      appUrl: 'https://app.example',
    });
    expect(subject).toMatch(/REJECT/i);
  });

  it('escapes HTML in inspector company name', () => {
    const { html } = buildLabNotificationEmail({
      deal: baseDeal,
      inspectorCompany: 'Lab <script>alert(1)</script>',
      labSummary: baseSummary,
      appUrl: 'https://app.example',
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('includes headline and deal link in body', () => {
    const { html } = buildLabNotificationEmail({
      deal: baseDeal,
      inspectorCompany: 'SGS',
      labSummary: baseSummary,
      appUrl: 'https://app.example',
    });
    expect(html).toContain('4/4 fields within spec');
    expect(html).toContain('https://app.example/deals/abcdef1234567890');
  });

  it('includes adjustment label when present', () => {
    const withPenalty: LabSummary = {
      headline: '2/3 within spec · penalty applied',
      tone: 'penalty',
      adjustmentLabel: '-$2.50/t',
    };
    const { html } = buildLabNotificationEmail({
      deal: baseDeal,
      inspectorCompany: 'SGS',
      labSummary: withPenalty,
      appUrl: 'https://app.example',
    });
    expect(html).toContain('-$2.50/t');
  });

  it('works with null inspector company', () => {
    const { html, subject } = buildLabNotificationEmail({
      deal: baseDeal,
      inspectorCompany: null,
      labSummary: baseSummary,
      appUrl: 'https://app.example',
    });
    expect(typeof html).toBe('string');
    expect(typeof subject).toBe('string');
  });
});
