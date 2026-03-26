import { requireAuth } from '@/lib/auth';
import { getDealsByUser, getDealDocuments } from '@/lib/deal-queries';
import { COMMODITY_CONFIG } from '@/lib/types';
import type { DealDocument, CommodityType } from '@/lib/types';
import { ContractClient } from './contract-client';

export const metadata = {
  title: 'Contract Book | MineMarket',
  description: 'Track documents and contracts across all your deals',
};

// Required documents per commodity
const REQUIRED_DOCS: Record<string, string[]> = {
  chrome: ['bill_of_lading', 'certificate_of_origin', 'weighbridge_ticket', 'lab_report', 'customs_declaration', 'invoice'],
  manganese: ['bill_of_lading', 'certificate_of_origin', 'weighbridge_ticket', 'lab_report', 'customs_declaration', 'invoice'],
  iron_ore: ['bill_of_lading', 'certificate_of_origin', 'weighbridge_ticket', 'lab_report', 'customs_declaration', 'invoice', 'draft_survey'],
  coal: ['bill_of_lading', 'certificate_of_origin', 'weighbridge_ticket', 'lab_report', 'customs_declaration', 'invoice'],
  platinum: ['bill_of_lading', 'assay_certificate', 'lbma_certificate', 'customs_declaration', 'invoice'],
  gold: ['bill_of_lading', 'assay_certificate', 'lbma_certificate', 'customs_declaration', 'invoice'],
  copper: ['bill_of_lading', 'certificate_of_origin', 'lab_report', 'lme_warrant', 'customs_declaration', 'invoice'],
  vanadium: ['bill_of_lading', 'certificate_of_origin', 'lab_report', 'customs_declaration', 'invoice'],
  titanium: ['bill_of_lading', 'certificate_of_origin', 'lab_report', 'customs_declaration', 'invoice'],
  aggregates: ['weighbridge_ticket', 'invoice'],
};

export default async function ContractsPage() {
  const user = await requireAuth();
  const deals = await getDealsByUser(user.id);

  // Fetch documents for all active deals
  const activeDeals = deals.filter(d => !['cancelled'].includes(d.status));
  const dealsWithDocs = await Promise.all(
    activeDeals.map(async (deal) => {
      const docs = await getDealDocuments(deal.id);
      const required = REQUIRED_DOCS[deal.commodity_type] || REQUIRED_DOCS.chrome;
      const uploadedTypes = new Set<string>(docs.map(d => d.doc_type));
      const completedCount = required.filter(t => uploadedTypes.has(t)).length;
      const progress = required.length > 0 ? completedCount / required.length : 0;
      const missingDocs = required.filter(t => !uploadedTypes.has(t));

      return {
        ...deal,
        documents: docs,
        requiredDocs: required,
        completedDocs: completedCount,
        totalRequiredDocs: required.length,
        progress,
        missingDocs,
        isBuyer: deal.buyer_id === user.id,
      };
    })
  );

  return <ContractClient deals={dealsWithDocs} />;
}
