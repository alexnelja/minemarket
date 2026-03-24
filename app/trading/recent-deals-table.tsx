import { COMMODITY_CONFIG } from '@/lib/types';
import { formatCurrency, timeAgo } from '@/lib/format';
import type { Deal } from '@/lib/types';

interface RecentDealsTableProps {
  deals: Deal[];
  avgPrice: number;
}

export function RecentDealsTable({ deals, avgPrice }: RecentDealsTableProps) {
  if (deals.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
        <p className="text-gray-500 text-sm">No completed deals yet for this commodity.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Recent Completed Deals</h2>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-500 border-b border-gray-800">
            <th className="px-4 py-2 text-left font-medium">Material</th>
            <th className="px-4 py-2 text-right font-medium">Price</th>
            <th className="px-4 py-2 text-right font-medium">Volume</th>
            <th className="px-4 py-2 text-right font-medium">Incoterm</th>
            <th className="px-4 py-2 text-right font-medium">When</th>
          </tr>
        </thead>
        <tbody>
          {deals.map((deal) => {
            const config = COMMODITY_CONFIG[deal.commodity_type];
            const aboveAvg = deal.agreed_price >= avgPrice;
            return (
              <tr key={deal.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: config.color }} />
                    <span className="text-white">{config.label}</span>
                  </div>
                </td>
                <td className={`px-4 py-2 text-right font-medium ${aboveAvg ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatCurrency(deal.agreed_price, deal.currency)}/t
                </td>
                <td className="px-4 py-2 text-right text-gray-400">
                  {deal.volume_tonnes.toLocaleString()}t
                </td>
                <td className="px-4 py-2 text-right text-gray-400">
                  {deal.incoterm}
                </td>
                <td className="px-4 py-2 text-right text-gray-500">
                  {timeAgo(deal.created_at)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
