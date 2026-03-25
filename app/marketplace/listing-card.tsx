import Link from 'next/link';
import { COMMODITY_CONFIG } from '@/lib/types';
import { timeAgo } from '@/lib/format';
import { CommodityDot } from '@/app/components/commodity-dot';
import type { Listing } from '@/lib/types';

interface ListingCardProps {
  listing: Listing;
}

export function ListingCard({ listing }: ListingCardProps) {
  const config = COMMODITY_CONFIG[listing.commodity_type];

  return (
    <Link href={`/marketplace/listings/${listing.id}`}>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors cursor-pointer h-full flex flex-col gap-3">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CommodityDot commodity={listing.commodity_type} size="lg" />
            <span className="text-sm font-semibold text-white">{config.label}</span>
          </div>
          {listing.is_verified && (
            <span className="text-xs bg-green-900/40 text-green-400 border border-green-800 rounded-full px-2 py-0.5">
              Verified
            </span>
          )}
        </div>

        {/* Price */}
        <div className="text-amber-400 text-xl font-bold">
          {listing.currency} {listing.price_per_tonne.toLocaleString()} / t
        </div>

        {/* Volume */}
        <div className="text-gray-300 text-sm">
          {listing.volume_tonnes.toLocaleString()} t
        </div>

        {/* Incoterms */}
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

        {/* Footer */}
        <div className="mt-auto text-xs text-gray-500">
          {timeAgo(listing.created_at)}
        </div>
      </div>
    </Link>
  );
}
