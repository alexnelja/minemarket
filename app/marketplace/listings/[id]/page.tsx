import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getListingById } from '@/lib/queries';
import { getSellerTrustScore, getListingVerifications } from '@/lib/trust-queries';
import { COMMODITY_CONFIG } from '@/lib/types';
import { timeAgo } from '@/lib/format';
import { ExpressInterestButton } from './express-interest-button';
import { CollapsibleSection } from './collapsible-section';
import { SPEC_LABELS } from '@/lib/spec-fields';
import { SUBTYPE_LABELS } from '@/lib/commodity-subtypes';
import { MarineWeatherCard } from '@/app/vessels/marine-weather-card';
import { estimateRoute, formatDistance, COMMON_DESTINATIONS } from '@/lib/distance';

interface ListingDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ListingDetailPage({ params }: ListingDetailPageProps) {
  const { id } = await params;
  const listing = await getListingById(id);

  if (!listing) {
    notFound();
  }

  const [sellerTrust, verifications] = await Promise.all([
    getSellerTrustScore(listing.seller_id),
    getListingVerifications(listing.id),
  ]);

  const config = COMMODITY_CONFIG[listing.commodity_type];

  // Subtype and price confidence from new columns (may not exist on older listings)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listingAny = listing as any;
  const subtypeKey: string | null = listingAny.commodity_subtype ?? null;
  const subtypeLabel = subtypeKey ? SUBTYPE_LABELS[subtypeKey] ?? null : null;
  const priceConfidence: string | null = listingAny.price_confidence ?? null;
  const priceBreakdown: { label: string; value: number; note: string }[] | null =
    listingAny.price_breakdown ?? null;

  const confidenceBadge: Record<string, { bg: string; text: string; border: string; label: string }> = {
    high: { bg: 'bg-green-900/40', text: 'text-green-400', border: 'border-green-800', label: 'High confidence' },
    medium: { bg: 'bg-amber-900/40', text: 'text-amber-400', border: 'border-amber-800', label: 'Medium confidence' },
    low: { bg: 'bg-red-900/40', text: 'text-red-400', border: 'border-red-800', label: 'Low confidence' },
    manual: { bg: 'bg-gray-800', text: 'text-gray-400', border: 'border-gray-700', label: 'Manual price' },
  };

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
                {subtypeLabel && (
                  <span className="text-xs bg-gray-800 text-gray-300 border border-gray-700 rounded-full px-2 py-0.5">
                    {subtypeLabel}
                  </span>
                )}
                {listing.is_verified && (
                  <span className="text-xs bg-green-900/40 text-green-400 border border-green-800 rounded-full px-2 py-0.5">
                    Verified
                  </span>
                )}
              </div>
              <p className="text-gray-400 text-sm mt-0.5">{listing.seller_company}</p>
              <div className="flex items-center gap-2 mt-1">
                {sellerTrust.ratingCount > 0 ? (
                  <>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${sellerTrust.badge.bg} ${sellerTrust.badge.color} ${sellerTrust.badge.border}`}>
                      {sellerTrust.badge.label}
                    </span>
                    <span className="text-xs text-gray-500">
                      {sellerTrust.overall.toFixed(1)}/5 ({sellerTrust.ratingCount} ratings)
                    </span>
                  </>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full border border-gray-700 text-gray-400 bg-gray-800">
                    New seller
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-amber-400 text-2xl font-bold">
              {listing.currency} {listing.price_per_tonne.toLocaleString()} / t
            </div>
            {priceConfidence && confidenceBadge[priceConfidence] && (
              <span className={`text-xs px-2 py-0.5 rounded-full border mt-1 inline-block ${confidenceBadge[priceConfidence].bg} ${confidenceBadge[priceConfidence].text} ${confidenceBadge[priceConfidence].border}`}>
                {confidenceBadge[priceConfidence].label}
              </span>
            )}
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

      {/* Loading Port Weather */}
      <MarineWeatherCard harbourId={listing.loading_port_id} />

      {/* Spec sheet */}
      {specEntries.length > 0 && (
        <CollapsibleSection title="SPEC SHEET" defaultOpen>
          <div className="grid grid-cols-2 gap-x-8 gap-y-3">
            {specEntries.map(([key, value]) => (
              <div key={key}>
                <p className="text-xs text-gray-500 mb-0.5">{SPEC_LABELS[key] ?? key}</p>
                <p className="text-sm text-white">{String(value)}</p>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Price vs Index (if price breakdown available) */}
      {priceBreakdown && priceBreakdown.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Price vs Index</h2>
          <div className="space-y-2">
            {priceBreakdown.map((item, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-800 last:border-0">
                <span className="text-sm text-gray-400">{item.label}</span>
                <div className="text-right">
                  <span className="text-sm text-white font-medium">{item.value}</span>
                  <span className="text-xs text-gray-600 ml-2">{item.note}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shipping Estimate */}
      {listing.harbour_location.lat !== 0 && listing.harbour_location.lng !== 0 && (
        <CollapsibleSection
          title="SHIPPING ESTIMATE"
          subtitle={`Estimated sea distances from ${listing.harbour_name} (${listing.volume_tonnes.toLocaleString()} t cargo)`}
        >
          <div className="space-y-3">
            {COMMON_DESTINATIONS.map((dest) => {
              const route = estimateRoute(
                listing.harbour_location.lat,
                listing.harbour_location.lng,
                dest.lat,
                dest.lng,
                listing.volume_tonnes,
              );
              return (
                <div
                  key={dest.name}
                  className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0"
                >
                  <div>
                    <p className="text-sm text-white">{dest.name}</p>
                    <p className="text-xs text-gray-500">
                      {formatDistance(route.nauticalMiles)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-amber-400">{route.transitDays} days</p>
                    <p className="text-xs text-gray-500">
                      {route.co2Tonnes} t CO₂
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </CollapsibleSection>
      )}

      {/* Verification Details */}
      {verifications.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Lab Verifications</h2>
          <div className="space-y-4">
            {verifications.map((v) => (
              <div key={v.id} className="border border-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-green-900/40 text-green-400 border border-green-800 rounded-full px-2 py-0.5">
                      {v.badge_level === 'premium' ? 'Premium Verified' : 'Verified'}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(v.verified_at).toLocaleDateString()}
                    </span>
                  </div>
                  <a
                    href={v.lab_report_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    View Lab Report
                  </a>
                </div>
                {Object.keys(v.assay_results).length > 0 && (
                  <div className="grid grid-cols-3 gap-x-6 gap-y-2">
                    {Object.entries(v.assay_results).map(([key, value]) => (
                      <div key={key}>
                        <p className="text-xs text-gray-500">{key}</p>
                        <p className="text-sm text-white">{String(value)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sticky CTA */}
      <div className="sticky bottom-0 bg-gray-950/95 backdrop-blur-lg border-t border-gray-800 px-6 py-4 -mx-6 mt-6">
        <div className="flex items-center justify-between max-w-3xl">
          <div>
            <p className="text-sm font-semibold text-white">Interested in this listing?</p>
            <p className="text-xs text-gray-500">Start a deal by expressing interest to the seller.</p>
          </div>
          <ExpressInterestButton listingId={listing.id} />
        </div>
      </div>
    </div>
  );
}
