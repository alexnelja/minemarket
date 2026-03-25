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
import { getTrustScoreForUser } from '@/lib/trust-queries';

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

  return (
    <div className="space-y-6 max-w-3xl">
      <Link
        href="/deals"
        className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200 transition-colors"
      >
        ← Back to Deals
      </Link>

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

      {/* Rating form — only shown for completed deals */}
      {(['completed', 'escrow_released'] as string[]).includes(deal.status) && !hasRated && (
        <RatingForm dealId={deal.id} />
      )}
    </div>
  );
}
