import Link from 'next/link';
import { getActiveListings, getActiveRequirements } from '@/lib/queries';
import { ListingCard } from './listing-card';
import { RequirementCard } from './requirement-card';

interface MarketplacePageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function MarketplacePage({ searchParams }: MarketplacePageProps) {
  const params = await searchParams;
  const tab = params.tab ?? 'listings';

  const [listings, requirements] = await Promise.all([
    getActiveListings(),
    getActiveRequirements(),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Marketplace</h1>
          <p className="text-gray-400 text-sm mt-1">Browse listings and buyer requirements.</p>
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

      {/* Tab bar */}
      <div className="flex gap-0 border-b border-gray-800">
        <Link
          href="/marketplace?tab=listings"
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'listings'
              ? 'text-white border-b-2 border-white'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Listings ({listings.length})
        </Link>
        <Link
          href="/marketplace?tab=requirements"
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'requirements'
              ? 'text-white border-b-2 border-white'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Requirements ({requirements.length})
        </Link>
      </div>

      {/* Content grid */}
      {tab === 'listings' ? (
        listings.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center text-gray-500">
            No active listings at the moment. Be the first to post one.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )
      ) : (
        requirements.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center text-gray-500">
            No active requirements at the moment. Post what you&apos;re looking for.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {requirements.map((requirement) => (
              <RequirementCard key={requirement.id} requirement={requirement} />
            ))}
          </div>
        )
      )}
    </div>
  );
}
