import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { getDealById, getDealMilestones, getDealDocuments, getDealRatings } from '@/lib/deal-queries';
import { COMMODITY_CONFIG } from '@/lib/types';
import type { Deal } from '@/lib/types';
import { formatCurrency, timeAgo } from '@/lib/format';
import { StatusBadge } from '@/app/components/status-badge';
import { DealActions } from './deal-actions';
import { MilestoneTimeline } from './milestone-timeline';
import { DocumentUpload } from './document-upload';
import { DocumentChecklist } from './document-checklist';
import { RatingForm } from './rating-form';
import { HedgingPanel } from './hedging-panel';
import { DealProgress } from './deal-progress';
import { DealTabs } from './deal-tabs';
import { DealMessages } from './deal-messages';
import { InviteCounterparty } from './invite-counterparty';
import { DocumentFlow } from './document-flow';
import { PnlTracker } from './pnl-tracker';
import { VerificationPanel } from './verification-panel';
import { verifyDealDocuments } from '@/lib/platform-verification';
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
  const isBuyer = deal.buyer_id === user.id;
  const hasRated = ratings.some((r) => r.rater_id === user.id);

  const counterpartyId = isBuyer ? deal.seller_id : deal.buyer_id;
  const counterpartyTrust = await getTrustScoreForUser(counterpartyId);

  // Compute platform verification
  const platformVerification = verifyDealDocuments(deal as Deal, documents);

  // Compute spec comparison for delivered+ deals
  const showSpecComparison = ['delivered', 'escrow_released', 'completed'].includes(deal.status);
  const specComparison = showSpecComparison
    && deal.spec_tolerances
    && Object.keys(deal.spec_tolerances).length > 0
    ? compareSpecs(
        deal.spec_tolerances as Record<string, SpecTolerance>,
        (deal.price_adjustment_rules ?? {}) as Record<string, PriceAdjustmentRule>,
        Object.fromEntries(
          Object.entries(deal.spec_tolerances as Record<string, SpecTolerance>).map(
            ([k, v]) => [k, v.target]
          )
        ),
      )
    : null;

  return (
    <div className="space-y-4 max-w-3xl">
      <Link
        href="/deals"
        className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200 transition-colors"
      >
        &larr; Back to Deals
      </Link>

      {/* Deal progress indicator */}
      <DealProgress status={deal.status} isBuyer={isBuyer} />

      {/* Condensed header */}
      <div className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl px-6 py-4 mb-4">
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: config.color }} />
          <h1 className="text-lg font-bold text-white">{config.label} Deal</h1>
          <StatusBadge status={deal.status} size="md" />
        </div>
        <div className="flex items-center gap-6 text-sm">
          <span className="text-gray-400">{isBuyer ? 'Seller' : 'Buyer'}: <span className="text-white">{deal.counterparty_name}</span></span>
          <span className="text-amber-400 font-bold">{formatCurrency(deal.agreed_price, deal.currency)}/t</span>
          <span className="text-gray-500">{deal.volume_tonnes.toLocaleString()}t &middot; {deal.incoterm}</span>
        </div>
      </div>

      {/* Tabbed workspace */}
      <DealTabs
        overviewContent={
          <div className="space-y-6">
            {/* Full details grid */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <p className="text-sm text-gray-400">
                  {isBuyer ? 'Seller' : 'Buyer'}: <span className="text-white">{deal.counterparty_name}</span>
                </p>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${counterpartyTrust.badge.bg} ${counterpartyTrust.badge.color} ${counterpartyTrust.badge.border}`}>
                  {counterpartyTrust.badge.label}
                </span>
                <span className="text-xs text-gray-500">
                  {counterpartyTrust.overall.toFixed(1)}/5
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-800">
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
                    {deal.escrow_amount ? formatCurrency(deal.escrow_amount, deal.currency) : '\u2014'}{' '}
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

            {/* Actions */}
            <DealActions
              dealId={deal.id}
              currentStatus={deal.status}
              isBuyer={isBuyer}
            />

            {/* P&L Tracker */}
            <PnlTracker
              dealId={deal.id}
              commodity={deal.commodity_type}
              agreedPrice={deal.agreed_price}
              volumeTonnes={deal.volume_tonnes}
              currency={deal.currency}
              isBuyer={isBuyer}
              status={deal.status}
              fxRateLocked={deal.fx_rate_locked}
              escrowAmount={deal.escrow_amount}
            />

            {/* Invite counterparty */}
            <InviteCounterparty dealId={deal.id} counterpartyName={deal.counterparty_name} />

            {/* Hedging panel */}
            {(['negotiation', 'second_accept', 'escrow_held'] as string[]).includes(deal.status) && (
              <HedgingPanel
                dealCurrency={deal.currency}
                agreedPrice={deal.agreed_price}
                volumeTonnes={deal.volume_tonnes}
                commodity={deal.commodity_type}
              />
            )}

            {/* Spec comparison for delivered+ deals */}
            {specComparison && specComparison.results.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Spec Comparison</h2>
                {specComparison.hasRejection && (
                  <div className="mb-4 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                    Material rejected &mdash; one or more fields outside tolerance
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
                              {r.priceAdjustment === 0 ? '\u2014' : `${r.priceAdjustment > 0 ? '+' : ''}${r.priceAdjustment.toFixed(2)}`}
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
                          {specComparison.totalAdjustment === 0 ? '\u2014' : `${specComparison.totalAdjustment > 0 ? '+' : ''}$${Math.abs(specComparison.totalAdjustment).toFixed(2)}/t`}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* Rating form for completed deals */}
            {(['completed', 'escrow_released'] as string[]).includes(deal.status) && !hasRated && (
              <RatingForm dealId={deal.id} />
            )}
          </div>
        }
        documentsContent={
          <div className="space-y-6">
            <DocumentFlow
              dealStatus={deal.status}
              documents={documents}
              commodity={deal.commodity_type}
            />
            <DocumentChecklist
              commodity={deal.commodity_type}
              documents={documents}
            />
            <details className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <summary className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-800/30">
                Verification & Inspection
              </summary>
              <div className="px-6 pb-6">
                <VerificationPanel dealId={deal.id} platformVerification={platformVerification} />
              </div>
            </details>
            <DocumentUpload
              dealId={deal.id}
              documents={documents}
            />
          </div>
        }
        shippingContent={
          <div className="space-y-6">
            <MilestoneTimeline
              dealId={deal.id}
              milestones={milestones}
              dealStatus={deal.status}
              isBuyer={isBuyer}
            />
          </div>
        }
        messagesContent={
          <DealMessages dealId={deal.id} currentUserId={user.id} counterpartyName={deal.counterparty_name} />
        }
      />
    </div>
  );
}
