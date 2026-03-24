import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getListingById } from '@/lib/queries';
import { COMMODITY_CONFIG } from '@/lib/types';
import { timeAgo } from '@/lib/format';
import { ExpressInterestButton } from './express-interest-button';

interface ListingDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ListingDetailPage({ params }: ListingDetailPageProps) {
  const { id } = await params;
  const listing = await getListingById(id);

  if (!listing) {
    notFound();
  }

  const config = COMMODITY_CONFIG[listing.commodity_type];

  const specEntries = Object.entries(listing.spec_sheet).filter(
    ([, value]) => value !== null && value !== undefined
  );

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Back link */}
      <Link
        href="/marketplace"
        className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200 transition-colors"
      >
        ← Back to Marketplace
      </Link>

      {/* Header */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className="w-4 h-4 rounded-full flex-shrink-0 mt-0.5"
              style={{ backgroundColor: config.color }}
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white">{config.label}</h1>
                {listing.is_verified && (
                  <span className="text-xs bg-green-900/40 text-green-400 border border-green-800 rounded-full px-2 py-0.5">
                    Verified
                  </span>
                )}
              </div>
              <p className="text-gray-400 text-sm mt-0.5">{listing.seller_company}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-amber-400 text-2xl font-bold">
              {listing.currency} {listing.price_per_tonne.toLocaleString()} / t
            </div>
            <div className="text-gray-500 text-xs mt-1">{timeAgo(listing.created_at)}</div>
          </div>
        </div>
      </div>

      {/* Details grid */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Details</h2>
        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">Source Mine</p>
            <p className="text-sm text-white">{listing.mine_name}</p>
            <p className="text-xs text-gray-500">{listing.mine_region}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Loading Port</p>
            <p className="text-sm text-white">{listing.harbour_name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Volume</p>
            <p className="text-sm text-white">{listing.volume_tonnes.toLocaleString()} t</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Incoterms</p>
            <div className="flex flex-wrap gap-1">
              {listing.incoterms.map((term) => (
                <span
                  key={term}
                  className="text-xs bg-gray-800 text-gray-300 rounded px-2 py-0.5 border border-gray-700"
                >
                  {term}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Allocation Mode</p>
            <p className="text-sm text-white capitalize">{listing.allocation_mode.replace('_', ' ')}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Status</p>
            <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
              listing.status === 'active'
                ? 'bg-green-900/40 text-green-400 border border-green-800'
                : 'bg-gray-800 text-gray-400 border border-gray-700'
            }`}>
              {listing.status}
            </span>
          </div>
        </div>
      </div>

      {/* Spec sheet */}
      {specEntries.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Spec Sheet</h2>
          <div className="grid grid-cols-2 gap-x-8 gap-y-3">
            {specEntries.map(([key, value]) => (
              <div key={key}>
                <p className="text-xs text-gray-500 mb-0.5">{key}</p>
                <p className="text-sm text-white">{String(value)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Express Interest */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Interested in this listing?</h2>
            <p className="text-xs text-gray-500 mt-1">Start a deal by expressing interest to the seller.</p>
          </div>
          <ExpressInterestButton listingId={listing.id} />
        </div>
      </div>
    </div>
  );
}
