'use client';

import { useState } from 'react';
import Link from 'next/link';
import { COMMODITY_CONFIG } from '@/lib/types';
import type { CommodityType, DealStatus } from '@/lib/types';
import { DEAL_STATUS_LABELS, DEAL_STATUS_COLORS } from '@/lib/deal-helpers';
import { CommodityDot } from '@/app/components/commodity-dot';
import { StatusBadge } from '@/app/components/status-badge';

interface Position {
  commodity: CommodityType;
  label: string;
  color: string;
  buyVolume: number;
  sellVolume: number;
  netVolume: number;
  buyValue: number;
  sellValue: number;
  netValue: number;
  avgBuyPrice: number;
  avgSellPrice: number;
  dealCount: number;
  activeDeals: number;
  completedDeals: number;
  exposure: number;
}

interface Deal {
  id: string;
  commodity_type: CommodityType;
  status: DealStatus;
  agreed_price: number;
  volume_tonnes: number;
  currency: string;
  incoterm: string;
  counterparty_name?: string;
  buyer_id: string;
  created_at: string;
}

interface PositionClientProps {
  positions: Position[];
  deals: Deal[];
  userId: string;
}

export function PositionClient({ positions, deals, userId }: PositionClientProps) {
  const [expandedCommodity, setExpandedCommodity] = useState<string | null>(null);

  const totalExposure = positions.reduce((s, p) => s + p.exposure, 0);
  const totalActiveDeals = positions.reduce((s, p) => s + p.activeDeals, 0);
  const totalCompletedDeals = positions.reduce((s, p) => s + p.completedDeals, 0);
  const totalBuyVolume = positions.reduce((s, p) => s + p.buyVolume, 0);
  const totalSellVolume = positions.reduce((s, p) => s + p.sellVolume, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Position Book</h1>
        <p className="text-gray-400 text-sm mt-1">Aggregate exposure across all your deals.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Total Exposure</p>
          <p className="text-2xl font-bold text-amber-400">${(totalExposure / 1e6).toFixed(1)}M</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Active Deals</p>
          <p className="text-2xl font-bold text-white">{totalActiveDeals}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Buy Volume</p>
          <p className="text-2xl font-bold text-emerald-400">{(totalBuyVolume / 1000).toFixed(0)}kt</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Sell Volume</p>
          <p className="text-2xl font-bold text-blue-400">{(totalSellVolume / 1000).toFixed(0)}kt</p>
        </div>
      </div>

      {/* Position table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 border-b border-gray-800">
              <th className="px-4 py-3 text-left font-medium">Commodity</th>
              <th className="px-4 py-3 text-right font-medium">Buy Vol</th>
              <th className="px-4 py-3 text-right font-medium">Sell Vol</th>
              <th className="px-4 py-3 text-right font-medium">Net</th>
              <th className="px-4 py-3 text-right font-medium hidden sm:table-cell">Avg Buy $/t</th>
              <th className="px-4 py-3 text-right font-medium hidden sm:table-cell">Avg Sell $/t</th>
              <th className="px-4 py-3 text-right font-medium">Exposure</th>
              <th className="px-4 py-3 text-right font-medium">Deals</th>
            </tr>
          </thead>
          <tbody>
            {positions.map(pos => {
              const isExpanded = expandedCommodity === pos.commodity;
              const commodityDeals = deals.filter(d => d.commodity_type === pos.commodity && !['completed', 'cancelled'].includes(d.status));

              return (
                <PositionRow
                  key={pos.commodity}
                  pos={pos}
                  isExpanded={isExpanded}
                  commodityDeals={commodityDeals}
                  userId={userId}
                  onToggle={() => setExpandedCommodity(isExpanded ? null : pos.commodity)}
                />
              );
            })}
          </tbody>
        </table>

        {positions.length === 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No positions yet</h3>
            <p className="text-sm text-gray-400 mb-6">Your exposure across all deals will appear here once you have active trades.</p>
            <div className="flex gap-3 justify-center">
              <Link href="/marketplace" className="text-sm bg-amber-500 hover:bg-amber-400 text-black font-semibold px-4 py-2 rounded-lg transition-colors">
                Browse Listings
              </Link>
              <Link href="/simulator" className="text-sm border border-gray-700 text-gray-300 hover:border-gray-500 px-4 py-2 rounded-lg transition-colors">
                Try Simulator
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Risk flags */}
      {positions.some(p => p.exposure > 1e6) && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
          <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">Risk Flags</h3>
          <div className="space-y-1">
            {positions.filter(p => p.exposure > 1e6).map(p => (
              <p key={p.commodity} className="text-xs text-amber-300">
                {p.label}: ${(p.exposure / 1e6).toFixed(1)}M exposure across {p.activeDeals} active deals
              </p>
            ))}
            {positions.filter(p => Math.abs(p.netVolume) > 10000).map(p => (
              <p key={`net-${p.commodity}`} className="text-xs text-amber-300">
                {p.label}: Unbalanced position — net {p.netVolume > 0 ? 'long' : 'short'} {Math.abs(p.netVolume / 1000).toFixed(1)}kt
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PositionRow({
  pos,
  isExpanded,
  commodityDeals,
  userId,
  onToggle,
}: {
  pos: Position;
  isExpanded: boolean;
  commodityDeals: Deal[];
  userId: string;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className="border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer"
        onClick={onToggle}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <CommodityDot commodity={pos.commodity} />
            <span className="text-white font-medium">{pos.label}</span>
            <span className="text-gray-600 text-xs">{isExpanded ? '\u25BE' : '\u25B8'}</span>
          </div>
        </td>
        <td className="px-4 py-3 text-right text-emerald-400">{pos.buyVolume > 0 ? `${(pos.buyVolume / 1000).toFixed(1)}kt` : '\u2014'}</td>
        <td className="px-4 py-3 text-right text-blue-400">{pos.sellVolume > 0 ? `${(pos.sellVolume / 1000).toFixed(1)}kt` : '\u2014'}</td>
        <td className={`px-4 py-3 text-right font-medium ${pos.netVolume > 0 ? 'text-emerald-400' : pos.netVolume < 0 ? 'text-red-400' : 'text-gray-500'}`}>
          {pos.netVolume !== 0 ? `${pos.netVolume > 0 ? '+' : ''}${(pos.netVolume / 1000).toFixed(1)}kt` : '\u2014'}
        </td>
        <td className="px-4 py-3 text-right text-gray-300 hidden sm:table-cell">
          {pos.avgBuyPrice > 0 ? `$${pos.avgBuyPrice.toFixed(0)}` : '\u2014'}
          {pos.avgBuyPrice > 0 && pos.avgBuyPrice < 10 && pos.commodity !== 'aggregates' && (
            <span className="text-[9px] text-gray-600 ml-1">*demo</span>
          )}
        </td>
        <td className="px-4 py-3 text-right text-gray-300 hidden sm:table-cell">
          {pos.avgSellPrice > 0 ? `$${pos.avgSellPrice.toFixed(0)}` : '\u2014'}
          {pos.avgSellPrice > 0 && pos.avgSellPrice < 10 && pos.commodity !== 'aggregates' && (
            <span className="text-[9px] text-gray-600 ml-1">*demo</span>
          )}
        </td>
        <td className="px-4 py-3 text-right text-amber-400 font-medium">${(pos.exposure / 1e6).toFixed(2)}M</td>
        <td className="px-4 py-3 text-right text-gray-400">{pos.activeDeals}/{pos.dealCount}</td>
      </tr>

      {/* Expanded deal rows */}
      {isExpanded && commodityDeals.map(deal => (
        <tr key={deal.id} className="bg-gray-800/20 border-b border-gray-800/30">
          <td className="px-4 py-2 pl-10">
            <Link href={`/deals/${deal.id}`} className="text-xs text-gray-300 hover:text-white">
              {deal.counterparty_name || 'View Deal'}
            </Link>
          </td>
          <td className="px-4 py-2 text-right text-xs text-gray-400">
            {deal.buyer_id === userId ? `${(deal.volume_tonnes / 1000).toFixed(1)}kt` : '\u2014'}
          </td>
          <td className="px-4 py-2 text-right text-xs text-gray-400">
            {deal.buyer_id !== userId ? `${(deal.volume_tonnes / 1000).toFixed(1)}kt` : '\u2014'}
          </td>
          <td className="px-4 py-2"></td>
          <td className="px-4 py-2 text-right text-xs text-gray-400 hidden sm:table-cell">${deal.agreed_price}</td>
          <td className="px-4 py-2 hidden sm:table-cell"></td>
          <td className="px-4 py-2 text-right text-xs text-gray-400">
            ${((deal.agreed_price * deal.volume_tonnes) / 1e6).toFixed(2)}M
          </td>
          <td className="px-4 py-2 text-right">
            <StatusBadge status={deal.status} size="sm" />
          </td>
        </tr>
      ))}
    </>
  );
}
