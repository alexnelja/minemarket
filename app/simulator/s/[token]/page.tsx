import { createAdminSupabaseClient } from '@/lib/supabase-server';
import { notFound } from 'next/navigation';
import { COMMODITY_CONFIG } from '@/lib/types';
import { QUALITY_BADGES, QUALITY_VARIANT, type DataQuality } from '@/lib/data-sources';
import { QualityBadge } from '@/app/components/quality-badge';
import Link from 'next/link';

export default async function SharedScenarioPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let scenario: any = null;
  try {
    const supabase = createAdminSupabaseClient();
    const { data } = await supabase
      .from('deal_scenarios')
      .select('*')
      .eq('share_token', token)
      .single();
    scenario = data;
  } catch {
    // Table may not exist
  }

  if (!scenario) {
    notFound();
  }

  const config = COMMODITY_CONFIG[scenario.commodity as keyof typeof COMMODITY_CONFIG];
  const steps = (scenario.cost_breakdown || []) as any[];
  const checkpoints = (scenario.verification_checkpoints || []) as any[];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: config?.color }} />
          <h1 className="text-2xl font-bold tracking-tight text-white">{scenario.name}</h1>
        </div>
        <p className="text-gray-400 text-sm">
          Shared scenario — {config?.label} {scenario.grade ? `${scenario.grade}%` : ''} | {scenario.sell_point.toUpperCase()} ${scenario.sell_price}/t | {scenario.volume_tonnes.toLocaleString()}t
        </p>
        <p className="text-gray-600 text-xs mt-1">
          Created {new Date(scenario.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
          {scenario.mine_name && ` — ${scenario.mine_name}`}
          {scenario.loading_port && ` via ${scenario.loading_port}`}
          {scenario.destination_name && ` → ${scenario.destination_name}`}
        </p>
      </div>

      {/* Breakeven hero */}
      {scenario.breakeven_buy_price && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-8 text-center">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Breakeven Buy Price</p>
          <p className="text-4xl font-bold tracking-tight text-emerald-400">
            ${scenario.breakeven_buy_price.toFixed(2)}/t
          </p>
          <div className="grid grid-cols-3 gap-4 mt-6 text-sm">
            <div>
              <p className="text-gray-500">Sell price</p>
              <p className="text-amber-400 font-semibold">${scenario.sell_price}/t {scenario.sell_point.toUpperCase()}</p>
            </div>
            <div>
              <p className="text-gray-500">Total costs</p>
              <p className="text-white font-semibold">${scenario.total_costs?.toFixed(2)}/t</p>
            </div>
            <div>
              <p className="text-gray-500">Index used</p>
              <p className="text-gray-300 font-semibold">
                {scenario.index_price_used ? `$${scenario.index_price_used}/t` : '---'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Cost breakdown */}
      {steps.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Cost Breakdown</h2>
          <div className="space-y-1">
            <div className="flex items-center justify-between py-2 border-b border-gray-800">
              <span className="text-sm text-amber-400 font-semibold">Sell Price ({scenario.sell_point.toUpperCase()})</span>
              <span className="text-sm text-amber-400 font-semibold">${scenario.sell_price}</span>
            </div>
            {steps.map((step: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-1.5 text-sm">
                <span className="text-gray-300">{step.label}</span>
                <div className="flex items-center gap-3">
                  <span className="text-red-400 tabular-nums">-${step.amount?.toFixed(2)}</span>
                  {step.quality && (
                    <QualityBadge
                      label={QUALITY_BADGES[step.quality as DataQuality]?.label || ''}
                      variant={QUALITY_VARIANT[step.quality as DataQuality] || 'default'}
                    />
                  )}
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between py-2 border-t border-gray-800 mt-2">
              <span className="text-sm text-emerald-400 font-semibold">Breakeven Buy Price</span>
              <span className="text-sm text-emerald-400 font-semibold">${scenario.breakeven_buy_price?.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Verification checkpoints */}
      {checkpoints.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Verification Checkpoints
          </h2>
          <div className="space-y-3">
            {checkpoints.map((cp: any, i: number) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-xs flex-shrink-0">
                  {cp.point === 'mine_gate' ? '⛏' : cp.point === 'fob' ? '🚢' : cp.point === 'cif' ? '📦' : '🏭'}
                </div>
                <div>
                  <p className="text-sm text-white">{cp.label} <span className="text-[10px] text-gray-500">({cp.point.toUpperCase()})</span></p>
                  <p className="text-xs text-gray-500">{cp.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Clone prompt */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
        <p className="text-gray-400 text-sm mb-3">Want to adjust this scenario?</p>
        <Link href="/simulator" className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-lg transition-colors inline-block">
          Open Simulator
        </Link>
      </div>
    </div>
  );
}
