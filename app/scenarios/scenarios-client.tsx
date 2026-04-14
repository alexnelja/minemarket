'use client';

import { useState } from 'react';
import Link from 'next/link';
import { COMMODITY_CONFIG } from '@/lib/types';

interface ScenarioSummary {
  id: string;
  name: string;
  commodity: string;
  commodity_subtype: string | null;
  sell_price: number;
  sell_point: string;
  buy_point: string;
  volume_tonnes: number;
  mine_name: string | null;
  loading_port: string | null;
  destination_name: string | null;
  breakeven_buy_price: number | null;
  total_costs: number | null;
  transport_mode: string | null;
  share_token: string | null;
  deal_id: string | null;
  index_price_used: number | null;
  grade: number | null;
  created_at: string;
  updated_at: string;
}

export function ScenariosClient({ scenarios }: { scenarios: ScenarioSummary[] }) {
  const [filter, setFilter] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const commodities = [...new Set(scenarios.map(s => s.commodity))];

  const filtered = filter === 'all'
    ? scenarios
    : scenarios.filter(s => s.commodity === filter);

  async function copyShareLink(shareToken: string, id: string) {
    const url = `${window.location.origin}/simulator/s/${shareToken}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function deleteScenario(id: string) {
    if (!confirm('Delete this scenario?')) return;
    const res = await fetch(`/api/scenarios/${id}`, { method: 'DELETE' });
    if (res.ok) {
      window.location.reload();
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">My Scenarios</h1>
          <p className="text-gray-400 text-sm mt-1">Saved reverse waterfall simulations</p>
        </div>
        <Link href="/simulator"
          className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-lg transition-colors">
          New Scenario
        </Link>
      </div>

      {/* Filters */}
      {commodities.length > 1 && (
        <div className="flex gap-2 mb-4">
          <button onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === 'all' ? 'bg-white text-black' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}>
            All ({scenarios.length})
          </button>
          {commodities.map(c => (
            <button key={c} onClick={() => setFilter(c)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                filter === c ? 'bg-white text-black' : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COMMODITY_CONFIG[c as keyof typeof COMMODITY_CONFIG]?.color }} />
              {COMMODITY_CONFIG[c as keyof typeof COMMODITY_CONFIG]?.label || c}
              ({scenarios.filter(s => s.commodity === c).length})
            </button>
          ))}
        </div>
      )}

      {/* Scenario list */}
      {filtered.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <p className="text-gray-400">No saved scenarios yet.</p>
          <p className="text-gray-500 text-sm mt-2">
            Run a simulation and click &quot;Save Scenario&quot; to start building your history.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(scenario => {
            const margin = scenario.index_price_used && scenario.breakeven_buy_price
              ? scenario.index_price_used - scenario.breakeven_buy_price
              : null;
            const isLinked = !!scenario.deal_id;
            const config = COMMODITY_CONFIG[scenario.commodity as keyof typeof COMMODITY_CONFIG];

            return (
              <div key={scenario.id}
                className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: config?.color }} />
                      <h3 className="text-sm font-semibold text-white truncate">{scenario.name}</h3>
                      {isLinked && (
                        <Link href={`/deals/${scenario.deal_id}`}
                          className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded flex-shrink-0">
                          Linked to Deal
                        </Link>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500 ml-5">
                      <span>{config?.label}{scenario.grade ? ` ${scenario.grade}%` : ''}</span>
                      <span>{scenario.sell_point.toUpperCase()} ${scenario.sell_price}/t</span>
                      <span>{scenario.volume_tonnes.toLocaleString()}t</span>
                      {scenario.mine_name && <span>{scenario.mine_name}</span>}
                      {scenario.loading_port && <span>via {scenario.loading_port}</span>}
                      {scenario.destination_name && <span>→ {scenario.destination_name}</span>}
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0 ml-4">
                    {scenario.breakeven_buy_price !== null && (
                      <p className="text-sm font-semibold text-white">
                        Breakeven: ${scenario.breakeven_buy_price.toFixed(2)}/t
                      </p>
                    )}
                    {margin !== null && (
                      <p className={`text-xs font-medium ${margin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        Margin: ${Math.abs(margin).toFixed(2)}/t
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3 ml-5">
                  <span className="text-[10px] text-gray-600">
                    {new Date(scenario.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  <div className="flex-1" />
                  {scenario.share_token && (
                    <button
                      onClick={() => copyShareLink(scenario.share_token!, scenario.id)}
                      className="text-[10px] text-gray-500 hover:text-white px-2 py-1 rounded transition-colors"
                    >
                      {copiedId === scenario.id ? 'Copied!' : 'Share Link'}
                    </button>
                  )}
                  <button
                    onClick={() => deleteScenario(scenario.id)}
                    className="text-[10px] text-gray-600 hover:text-red-400 px-2 py-1 rounded transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
