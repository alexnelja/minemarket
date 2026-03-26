'use client';

import Link from 'next/link';
import { COMMODITY_CONFIG } from '@/lib/types';
import type { DealStatus, CommodityType, DocType } from '@/lib/types';
import { CommodityDot } from '@/app/components/commodity-dot';
import { StatusBadge } from '@/app/components/status-badge';

const DOC_LABELS: Record<string, string> = {
  bill_of_lading: 'Bill of Lading',
  certificate_of_origin: 'Certificate of Origin',
  weighbridge_ticket: 'Weighbridge Ticket',
  lab_report: 'Lab Report',
  customs_declaration: 'Customs Declaration',
  invoice: 'Invoice',
  lbma_certificate: 'LBMA Certificate',
  lme_warrant: 'LME Warrant',
  assay_certificate: 'Assay Certificate',
  draft_survey: 'Draft Survey',
  phytosanitary_certificate: 'Phytosanitary Certificate',
};

interface DealWithDocs {
  id: string;
  commodity_type: CommodityType;
  status: DealStatus;
  agreed_price: number;
  volume_tonnes: number;
  currency: string;
  incoterm: string;
  counterparty_name: string;
  mine_name: string;
  harbour_name: string;
  created_at: string;
  completedDocs: number;
  totalRequiredDocs: number;
  progress: number;
  missingDocs: string[];
  isBuyer: boolean;
}

interface ContractClientProps {
  deals: DealWithDocs[];
}

export function ContractClient({ deals }: ContractClientProps) {
  const activeDeals = deals.filter(d => !['completed', 'cancelled'].includes(d.status));
  const completedDeals = deals.filter(d => d.status === 'completed');
  const totalMissing = activeDeals.reduce((s, d) => s + d.missingDocs.length, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contract Book</h1>
          <p className="text-gray-400 text-sm mt-1">Track documents and contracts across all your deals.</p>
        </div>
        {totalMissing > 0 && (
          <div className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-1.5 rounded-full">
            {totalMissing} documents pending
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Active Contracts</p>
          <p className="text-2xl font-bold text-white">{activeDeals.length}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Documents Pending</p>
          <p className="text-2xl font-bold text-amber-400">{totalMissing}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Completed</p>
          <p className="text-2xl font-bold text-emerald-400">{completedDeals.length}</p>
        </div>
      </div>

      {/* Deal cards */}
      <div className="space-y-4">
        {activeDeals.length === 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500 text-sm">
            No active contracts. <Link href="/marketplace" className="text-amber-400">Browse listings</Link> to start a deal.
          </div>
        )}

        {activeDeals.map(deal => (
          <div key={deal.id} className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <CommodityDot commodity={deal.commodity_type} size="lg" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">
                      {COMMODITY_CONFIG[deal.commodity_type]?.label}
                    </span>
                    <StatusBadge status={deal.status} />
                  </div>
                  <p className="text-xs text-gray-500">
                    {deal.isBuyer ? 'Buying from' : 'Selling to'} {deal.counterparty_name} · {deal.volume_tonnes.toLocaleString()}t · ${deal.agreed_price}/t {deal.incoterm}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-amber-400">${((deal.agreed_price * deal.volume_tonnes) / 1e6).toFixed(2)}M</p>
                <p className="text-xs text-gray-500">{deal.mine_name} &rarr; {deal.harbour_name}</p>
              </div>
            </div>

            {/* Document progress */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-400">Documents</span>
                <span className="text-xs text-gray-500">{deal.completedDocs}/{deal.totalRequiredDocs}</span>
              </div>
              <div className="w-full h-1.5 bg-gray-800 rounded-full">
                <div
                  className={`h-full rounded-full transition-all ${deal.progress === 1 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  style={{ width: `${deal.progress * 100}%` }}
                />
              </div>
            </div>

            {/* Missing documents */}
            {deal.missingDocs.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {deal.missingDocs.map(doc => (
                  <span key={doc} className="text-[10px] px-2 py-0.5 rounded-full border border-amber-500/20 text-amber-400 bg-amber-500/5">
                    {DOC_LABELS[doc] || doc}
                  </span>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2 border-t border-gray-800">
              <Link
                href={`/deals/${deal.id}`}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-700 text-gray-300 hover:border-gray-500 transition-colors"
              >
                View Deal
              </Link>
              <Link
                href={`/deals/${deal.id}?tab=documents`}
                className="text-xs font-medium px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black transition-colors"
              >
                Upload Documents
              </Link>
            </div>
          </div>
        ))}

        {/* Completed deals (collapsed) */}
        {completedDeals.length > 0 && (
          <details className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <summary className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-800/30">
              Completed Contracts ({completedDeals.length})
            </summary>
            <div className="px-6 pb-4 space-y-2">
              {completedDeals.map(deal => (
                <Link
                  key={deal.id}
                  href={`/deals/${deal.id}`}
                  className="flex items-center gap-3 py-2 hover:bg-gray-800/30 rounded-lg px-2 transition-colors"
                >
                  <CommodityDot commodity={deal.commodity_type} size="sm" />
                  <span className="text-xs text-gray-400 flex-1">{deal.counterparty_name}</span>
                  <span className="text-xs text-gray-500">{deal.volume_tonnes.toLocaleString()}t</span>
                  <span className="text-xs text-emerald-400">${((deal.agreed_price * deal.volume_tonnes) / 1e6).toFixed(2)}M</span>
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">Complete</span>
                </Link>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
