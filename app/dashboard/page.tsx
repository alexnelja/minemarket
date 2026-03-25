import Link from 'next/link';
import { requireAuth } from '@/lib/auth';
import { getUserListings, getUserRequirements } from '@/lib/queries';
import { getDealsByUser } from '@/lib/deal-queries';
import { DEAL_STATUS_LABELS, DEAL_STATUS_COLORS } from '@/lib/deal-helpers';
import { COMMODITY_CONFIG } from '@/lib/types';
import { timeAgo, formatCurrency } from '@/lib/format';

export default async function DashboardPage() {
  const user = await requireAuth();

  const [listings, requirements, deals] = await Promise.all([
    getUserListings(user.id),
    getUserRequirements(user.id),
    getDealsByUser(user.id),
  ]);

  const activeDeals = deals.filter((d) =>
    !['completed', 'cancelled'].includes(d.status)
  );

  const activeListings = listings.filter((l) => l.status === 'active');
  const activeRequirements = requirements.filter((r) => r.status === 'active');
  const verifiedListings = listings.filter((l) => l.is_verified);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">
            {user.company_name} · {user.role}
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/marketplace/new-listing"
            className="bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            + New Listing
          </Link>
          <Link
            href="/marketplace/new-requirement"
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            + New Requirement
          </Link>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Active Listings</p>
          <p className="text-3xl font-bold text-white">{activeListings.length}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Active Requirements</p>
          <p className="text-3xl font-bold text-white">{activeRequirements.length}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Verified Listings</p>
          <p className="text-3xl font-bold text-green-400">{verifiedListings.length}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">KYC Status</p>
          <p className={`text-lg font-semibold capitalize mt-1 ${
            user.kyc_status === 'verified'
              ? 'text-green-400'
              : user.kyc_status === 'rejected'
              ? 'text-red-400'
              : 'text-amber-400'
          }`}>
            {user.kyc_status}
          </p>
        </div>
      </div>

      {/* Listings section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-white">My Listings</h2>
          <Link
            href="/marketplace?tab=listings"
            className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
          >
            View all →
          </Link>
        </div>
        {listings.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500 text-sm">
            You have no listings yet.{' '}
            <Link href="/marketplace/new-listing" className="text-amber-400 hover:text-amber-300">
              Create one.
            </Link>
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden divide-y divide-gray-800">
            {listings.map((listing) => {
              const cfg = COMMODITY_CONFIG[listing.commodity_type];
              return (
                <Link
                  key={listing.id}
                  href={`/marketplace/listings/${listing.id}`}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-800/50 transition-colors"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: cfg.color }}
                  />
                  <span className="text-sm text-white w-28 flex-shrink-0">{cfg.label}</span>
                  <span className="text-sm text-gray-400 flex-1">
                    {listing.volume_tonnes.toLocaleString()} t
                  </span>
                  <span className="text-sm text-amber-400 font-medium">
                    {listing.currency} {listing.price_per_tonne.toLocaleString()} / t
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full capitalize ml-2 ${
                    listing.status === 'active'
                      ? 'bg-green-900/40 text-green-400 border border-green-800'
                      : 'bg-gray-800 text-gray-400 border border-gray-700'
                  }`}>
                    {listing.status}
                  </span>
                  <span className="text-xs text-gray-600 ml-2 w-16 text-right flex-shrink-0">
                    {timeAgo(listing.created_at)}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Requirements section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-white">My Requirements</h2>
          <Link
            href="/marketplace?tab=requirements"
            className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
          >
            View all →
          </Link>
        </div>
        {requirements.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500 text-sm">
            You have no requirements yet.{' '}
            <Link href="/marketplace/new-requirement" className="text-blue-400 hover:text-blue-300">
              Post one.
            </Link>
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden divide-y divide-gray-800">
            {requirements.map((req) => {
              const cfg = COMMODITY_CONFIG[req.commodity_type];
              return (
                <div
                  key={req.id}
                  className="flex items-center gap-4 px-5 py-3.5"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: cfg.color }}
                  />
                  <span className="text-sm text-white w-28 flex-shrink-0">{cfg.label}</span>
                  <span className="text-sm text-gray-400 flex-1">
                    {req.volume_needed.toLocaleString()} t
                  </span>
                  <span className="text-sm text-blue-400 font-medium">
                    {req.currency} {req.target_price.toLocaleString()} / t
                  </span>
                  <span className="text-xs text-gray-500 ml-2">
                    {req.delivery_port}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full capitalize ml-2 ${
                    req.status === 'active'
                      ? 'bg-green-900/40 text-green-400 border border-green-800'
                      : 'bg-gray-800 text-gray-400 border border-gray-700'
                  }`}>
                    {req.status}
                  </span>
                  <span className="text-xs text-gray-600 ml-2 w-16 text-right flex-shrink-0">
                    {timeAgo(req.created_at)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Active Deals */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-white">Active Deals</h2>
          <Link
            href="/deals"
            className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
          >
            View all →
          </Link>
        </div>
        {activeDeals.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500 text-sm">
            No active deals.{' '}
            <Link href="/marketplace" className="text-amber-400 hover:text-amber-300">
              Browse listings.
            </Link>
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden divide-y divide-gray-800">
            {activeDeals.map((deal) => {
              const cfg = COMMODITY_CONFIG[deal.commodity_type];
              const statusColors = DEAL_STATUS_COLORS[deal.status];
              return (
                <Link
                  key={deal.id}
                  href={`/deals/${deal.id}`}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-800/50 transition-colors"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: cfg.color }}
                  />
                  <span className="text-sm text-white w-28 flex-shrink-0">{cfg.label}</span>
                  <span className="text-sm text-gray-400 flex-1">
                    {deal.counterparty_name}
                  </span>
                  <span className="text-sm text-amber-400 font-medium">
                    {formatCurrency(deal.agreed_price, deal.currency)}/t
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ml-2 ${statusColors.bg} ${statusColors.text} ${statusColors.border}`}>
                    {DEAL_STATUS_LABELS[deal.status]}
                  </span>
                  <span className="text-xs text-gray-600 ml-2 w-16 text-right flex-shrink-0">
                    {timeAgo(deal.created_at)}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Trust Score — placeholder until Plan 4 */}
      <div>
        <h2 className="text-base font-semibold text-white mb-3">Trust Score</h2>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-600 text-sm">
          Reputation and trust scoring coming in Plan 4.
        </div>
      </div>
    </div>
  );
}
