import type { CurrencyType } from './types';
import { SPEC_FIELDS } from './spec-fields';
import { COMMODITY_CONFIG, type CommodityType } from './types';

/**
 * Term-sheet data is the pure, source-of-truth shape rendered into a PDF.
 * All formatting decisions (labels, date shape, tolerance phrasing) live here
 * so the PDF renderer stays thin and the logic stays testable without JSX.
 */

export interface TermSheetDeal {
  id: string;
  commodity_type: CommodityType;
  commodity_subtype: string | null;
  volume_tonnes: number;
  agreed_price: number;
  currency: CurrencyType;
  incoterm: string;
  spec_tolerances: Record<string, unknown>;
  price_adjustment_rules: Record<string, unknown>;
  created_at: string;
  second_accept_at: string | null;
}

export interface TermSheetParty {
  id: string;
  name: string;
  email: string;
}

export interface TermSheetParties {
  buyer: TermSheetParty;
  seller: TermSheetParty;
}

export interface TermSheetSpecRow {
  key: string;
  label: string;
  constraint: string;
}

export interface TermSheetData {
  title: string;
  deal_ref: string;
  parties: {
    buyer: { name: string; email: string };
    seller: { name: string; email: string };
  };
  commercials: {
    commodity: string;
    subtype: string | null;
    volume_tonnes: number;
    unit_price_usd: number;
    currency: string;
    total_value_usd: number;
    incoterm: string;
  };
  spec_rows: TermSheetSpecRow[];
  dates: {
    effective_date: string;
    generated_at: string;
  };
}

function formatDateOnly(iso: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

function labelForSpec(commodity: CommodityType, key: string): string {
  const fields = SPEC_FIELDS[commodity] ?? [];
  return fields.find(f => f.key === key)?.label ?? key;
}

function constraintText(tolerance: unknown): string {
  if (!tolerance || typeof tolerance !== 'object') return '';
  const t = tolerance as { min?: number; max?: number };
  const hasMin = typeof t.min === 'number';
  const hasMax = typeof t.max === 'number';
  if (hasMin && hasMax) return `${t.min}-${t.max}`;
  if (hasMin) return `≥ ${t.min} (min)`;
  if (hasMax) return `≤ ${t.max} (max)`;
  return '';
}

export function buildTermSheetData(
  deal: TermSheetDeal,
  parties: TermSheetParties,
): TermSheetData {
  const commodityLabel = COMMODITY_CONFIG[deal.commodity_type]?.label ?? deal.commodity_type;
  const shortRef = deal.id.slice(0, 8);

  const specEntries = Object.entries(deal.spec_tolerances ?? {});
  const spec_rows: TermSheetSpecRow[] = specEntries
    .map(([key, tol]) => ({
      key,
      label: labelForSpec(deal.commodity_type, key),
      constraint: constraintText(tol),
    }))
    .filter(r => r.constraint !== '');

  const effectiveDate = deal.second_accept_at
    ? formatDateOnly(deal.second_accept_at)
    : formatDateOnly(deal.created_at);

  return {
    title: `${commodityLabel} Term Sheet — ${shortRef}`,
    deal_ref: shortRef,
    parties: {
      buyer: { name: parties.buyer.name || '—', email: parties.buyer.email },
      seller: { name: parties.seller.name || '—', email: parties.seller.email },
    },
    commercials: {
      commodity: commodityLabel,
      subtype: deal.commodity_subtype,
      volume_tonnes: deal.volume_tonnes,
      unit_price_usd: deal.agreed_price,
      currency: deal.currency,
      total_value_usd: deal.volume_tonnes * deal.agreed_price,
      incoterm: deal.incoterm,
    },
    spec_rows,
    dates: {
      effective_date: effectiveDate,
      generated_at: new Date().toISOString().slice(0, 10),
    },
  };
}
