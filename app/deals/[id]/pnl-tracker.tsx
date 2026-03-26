'use client';

import { useState, useEffect } from 'react';

interface PnlTrackerProps {
  dealId: string;
  commodity: string;
  agreedPrice: number;
  volumeTonnes: number;
  currency: string;
  isBuyer: boolean;
  status: string;
  fxRateLocked: number | null;
  escrowAmount: number | null;
}

export function PnlTracker({
  commodity, agreedPrice, volumeTonnes, currency, isBuyer, status, fxRateLocked, escrowAmount,
}: PnlTrackerProps) {
  const [marketPrice, setMarketPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/price-estimate?commodity=${commodity}`)
      .then(r => r.json())
      .then(data => {
        if (data.estimatedPrice) setMarketPrice(data.estimatedPrice);
        else if (data.basePrice) setMarketPrice(data.basePrice);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [commodity]);

  if (loading) return null;

  const dealValue = agreedPrice * volumeTonnes;
  const currentMarketValue = marketPrice ? marketPrice * volumeTonnes : null;
  const isCompleted = ['completed', 'escrow_released'].includes(status);

  // P&L calculation
  let unrealizedPnl = 0;
  let pnlPct = 0;

  if (currentMarketValue && !isCompleted) {
    if (isBuyer) {
      // Buyer profits when market price > agreed price
      unrealizedPnl = (marketPrice! - agreedPrice) * volumeTonnes;
    } else {
      // Seller profits when agreed price > market price (sold high)
      unrealizedPnl = (agreedPrice - marketPrice!) * volumeTonnes;
    }
    pnlPct = (unrealizedPnl / dealValue) * 100;
  }

  const isProfit = unrealizedPnl >= 0;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">P&L Tracker</h3>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs text-gray-500">Deal Value</p>
          <p className="text-sm font-semibold text-white">{currency} {dealValue.toLocaleString()}</p>
          <p className="text-[10px] text-gray-600">{volumeTonnes.toLocaleString()}t x ${agreedPrice}/t</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Market Value</p>
          {currentMarketValue ? (
            <>
              <p className="text-sm font-semibold text-white">{currency} {currentMarketValue.toLocaleString()}</p>
              <p className="text-[10px] text-gray-600">{volumeTonnes.toLocaleString()}t x ${marketPrice}/t (latest index)</p>
            </>
          ) : (
            <p className="text-sm text-gray-500">No index available</p>
          )}
        </div>
      </div>

      {/* P&L */}
      {currentMarketValue && !isCompleted && (
        <div className={`rounded-lg p-4 text-center ${isProfit ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
          <p className="text-xs text-gray-400 mb-1">{isBuyer ? 'Unrealized' : 'Mark-to-Market'} P&L</p>
          <p className={`text-2xl font-bold ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
            {isProfit ? '+' : ''}{currency} {unrealizedPnl.toLocaleString()}
          </p>
          <p className={`text-xs ${isProfit ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
            {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}% vs deal price
          </p>
          <p className="text-[10px] text-gray-500 mt-2">
            {isBuyer ? 'You bought' : 'You sold'} at ${agreedPrice}/t &middot; Market is now ${marketPrice}/t
          </p>
        </div>
      )}

      {isCompleted && (
        <div className="bg-gray-800 rounded-lg p-4 text-center">
          <p className="text-xs text-gray-400 mb-1">Deal Completed</p>
          <p className="text-sm text-white">
            {escrowAmount ? `Escrow: ${currency} ${escrowAmount.toLocaleString()} (${(escrowAmount / volumeTonnes).toFixed(2)}/t)` : 'Settled'}
          </p>
        </div>
      )}

      {/* FX impact */}
      {fxRateLocked && currency !== 'USD' && (
        <div className="mt-3 pt-3 border-t border-gray-800">
          <p className="text-xs text-gray-500">FX Rate Locked: 1 USD = {fxRateLocked} {currency}</p>
        </div>
      )}
    </div>
  );
}
