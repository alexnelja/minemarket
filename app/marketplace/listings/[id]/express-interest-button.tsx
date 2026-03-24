'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ExpressInterestButton({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExpressInterest() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_id: listingId }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409 && data.existing_deal_id) {
          router.push(`/deals/${data.existing_deal_id}`);
          return;
        }
        setError(data.error || 'Failed to express interest');
        return;
      }

      router.push(`/deals/${data.id}`);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleExpressInterest}
        disabled={loading}
        className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
      >
        {loading ? 'Submitting\u2026' : 'Express Interest'}
      </button>
      {error && (
        <p className="text-xs text-red-400 mt-2 text-right">{error}</p>
      )}
    </div>
  );
}
