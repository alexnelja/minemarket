import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { getDealById, getDealMilestones, getDealDocuments, getDealRatings } from '@/lib/deal-queries';
import { DEAL_STATUS_LABELS, DEAL_STATUS_COLORS } from '@/lib/deal-helpers';
import { COMMODITY_CONFIG } from '@/lib/types';
import { formatCurrency, timeAgo } from '@/lib/format';
import { DealActions } from './deal-actions';
import { MilestoneTimeline } from './milestone-timeline';
import { DocumentUpload } from './document-upload';
import { RatingForm } from './rating-form';
import { HedgingPanel } from './hedging-panel';
import { DealProgress } from './deal-progress';
import { getTrustScoreForUser } from '@/lib/trust-queries';
import { compareSpecs } from '@/lib/spec-comparison';
import type { SpecTolerance, PriceAdjustmentRule } from '@/lib/spec-comparison';
import { SPEC_LABELS } from '@/lib/spec-fields';

interface DealDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function DealDetailPage({ params }: DealDetailPageProps) {
  const user = await requireAuth();
  const { id } = await params;

  const deal = await getDealById(id, user.id);
  if (!deal) notFound();

  const [milestones, documents, ratings] = await Promise.all([
    getDealMilestones(id),
    getDealDocuments(id),
    getDealRatings(id),
  ]);

  const config = COMMODITY_CONFIG[deal.commodity_type];
  const statusColors = DEAL_STATUS_COLORS[deal.status];
  const isBuyer = deal.buyer_id === user.id;
  const hasRated = ratings.some((r) => r.rater_id === user.id);

  const counterpartyId = isBuyer ? deal.seller_id : deal.buyer_id;
  const counterpartyTrust = await getTrustScoreForUser(counterpartyId);

  // Compute spec comparison for delivered+ deals
  const showSpecComparison = ['delivered', 'escrow_released', 'completed'].includes(deal.status);
  const specComparison = showSpecComparison
    && deal.spec_tolerances
    && Object.keys(deal.spec_tolerances).length > 0
    ? compareSpecs(
        deal.spec_tolerances as Record<string, SpecTolerance>,
        (deal.price_adjustment_rules ?? {}) as Record<string, PriceAdjustmentRule>,
        // In production, actual_spec would come from lab reports / weighbridge data.
        // For now, use target values as placeholder (no deviation).
        Object.fromEntries(
          Object.entries(deal.spec_tolerances as Record<string, SpecTolerance>).map(
            ([k, v]) => [k, v.target]
          )
        ),
      )
    : null;

  return (
    <div className="space-y-6 max-w-3xl">
      <Link
        href="/deals"
        className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200 transition-colors"
      >
        ← Back to Deals
      </Link>

      {/* Deal progress indicator */}
      <DealProgress status={deal.status} isBuyer={isBuyer} />

      {/* Header */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: config.color }} />
              <h1 className="text-xl font-bold text-white">{config.label} Deal</h1>
              <span className={`text-xs px-2.5 py-0.5 rounded-full border ${statusColors.bg} ${statusColors.text} ${statusColors.border}`}>
                {DEAL_STATUS_LABELS[deal.status]}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-gray-400 text-sm">
                {isBuyer ? 'Seller' : 'Buyer'}: {deal.counterparty_name}
              </p>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${counterpartyTrust.badge.bg} ${counterpartyTrust.badge.color} ${counterpartyTrust.badge.border}`}>
                {counterpartyTrust.badge.label}
              </span>
              <span className="text-xs text-gray-500">
                {counterpartyTrust.overall.toFixed(1)}/5
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-amber-400 text-xl font-bold">
              {formatCurrency(deal.agreed_price, deal.currency)}/t
            </div>
            <div className="text-gray-500 text-xs mt-0.5">
              {deal.volume_tonnes.toLocaleString()}t · {deal.incoterm}
            </div>
          </div>
        </div>

        {/* Deal details grid */}
        <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-gray-800">
          <div>
            <p className="text-xs text-gray-500">Mine</p>
            <p className="text-sm text-white">{deal.mine_name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Loading Port</p>
            <p className="text-sm text-white">{deal.harbour_name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Total Value</p>
            <p className="text-sm text-white">
              {formatCurrency(deal.agreed_price * deal.volume_tonnes, deal.currency)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Escrow</p>
            <p className="text-sm text-white capitalize">
              {deal.escrow_amount ? formatCurrency(deal.escrow_amount, deal.currency) : '—'}{' '}
              <span className="text-gray-500">({deal.escrow_status.replace('_', ' ')})</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Created</p>
            <p className="text-sm text-white">{timeAgo(deal.created_at)}</p>
          </div>
          {deal.second_accept_at && (
            <div>
              <p className="text-xs text-gray-500">Second Accept</p>
              <p className="text-sm text-white">{timeAgo(deal.second_accept_at)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Actions — advance deal status */}
      <DealActions
        dealId={deal.id}
        currentStatus={deal.status}
        isBuyer={isBuyer}
      />

      {/* Hedging panel — shown for deals in negotiation, second_accept, or escrow_held */}
      {(['negotiation', 'second_accept', 'escrow_held'] as string[]).includes(deal.status) && (
        <HedgingPanel
          dealCurrency={deal.currency}
          agreedPrice={deal.agreed_price}
          volumeTonnes={deal.volume_tonnes}
          commodity={deal.commodity_type}
        />
      )}

      {/* Milestone timeline */}
      <MilestoneTimeline
        dealId={deal.id}
        milestones={milestones}
        dealStatus={deal.status}
        isBuyer={isBuyer}
      />

      {/* Documents */}
      <DocumentUpload
        dealId={deal.id}
        documents={documents}
      />

      {/* Spec Comparison — shown for delivered+ deals with spec tolerances */}
      {specComparison && specComparison.results.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Spec Comparison</h2>
          {specComparison.hasRejection && (
            <div className="mb-4 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              Material rejected — one or more fields outside tolerance
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-gray-800">
                  <th className="text-left py-2 pr-4">Field</th>
                  <th className="text-right py-2 px-3">Target</th>
                  <th className="text-right py-2 px-3">Actual</th>
                  <th className="text-right py-2 px-3">Deviation</th>
                  <th className="text-left py-2 px-3">Status</th>
                  <th className="text-right py-2 pl-3">Adjustment ($/t)</th>
                </tr>
              </thead>
              <tbody>
                {specComparison.results.map((r) => {
                  const statusColor =
                    r.status === 'within_spec' ? 'text-emerald-400'
                    : r.status === 'bonus' ? 'text-blue-400'
                    : r.status === 'penalty' ? 'text-amber-400'
                    : 'text-red-400';
                  const statusLabel =
                    r.status === 'within_spec' ? 'OK'
                    : r.status === 'bonus' ? 'Bonus'
                    : r.status === 'penalty' ? 'Penalty'
                    : 'REJECT';
                  return (
                    <tr key={r.field} className="border-b border-gray-800/50">
                      <td className="py-2 pr-4 text-white">{SPEC_LABELS[r.field] ?? r.field}</td>
                      <td className="py-2 px-3 text-right text-gray-400">{r.target.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right text-white">{r.actual.toFixed(2)}</td>
                      <td className={`py-2 px-3 text-right ${r.deviation === 0 ? 'text-gray-500' : r.deviation > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {r.deviation >= 0 ? '+' : ''}{r.deviation.toFixed(2)}
                      </td>
                      <td className={`py-2 px-3 ${statusColor} font-medium`}>{statusLabel}</td>
                      <td className={`py-2 pl-3 text-right ${r.priceAdjustment === 0 ? 'text-gray-500' : r.priceAdjustment > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {r.priceAdjustment === 0 ? '—' : `${r.priceAdjustment > 0 ? '+' : ''}${r.priceAdjustment.toFixed(2)}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5} className="py-3 text-right text-sm text-gray-400 font-medium">
                    Total Price Adjustment
                  </td>
                  <td className={`py-3 pl-3 text-right font-bold ${specComparison.totalAdjustment === 0 ? 'text-gray-400' : specComparison.totalAdjustment > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {specComparison.totalAdjustment === 0 ? '—' : `${specComparison.totalAdjustment > 0 ? '+' : ''}$${Math.abs(specComparison.totalAdjustment).toFixed(2)}/t`}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Rating form — only shown for completed deals */}
      {(['completed', 'escrow_released'] as string[]).includes(deal.status) && !hasRated && (
        <RatingForm dealId={deal.id} />
      )}
    </div>
  );
}
