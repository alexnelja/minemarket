'use client';

import type { PriceWaterfall } from '@/lib/price-waterfall';

interface PriceWaterfallChartProps {
  waterfall: PriceWaterfall;
}

export function PriceWaterfallChart({ waterfall }: PriceWaterfallChartProps) {
  const { steps, margin } = waterfall;
  const cifPrice = waterfall.cifPrice;

  // Color by category
  const categoryColors: Record<string, string> = {
    price: 'bg-white',
    freight: 'bg-blue-500',
    port: 'bg-purple-500',
    tax: 'bg-red-500',
    inland: 'bg-amber-500',
    other: 'bg-gray-500',
  };

  const categoryLabels: Record<string, string> = {
    price: 'Price level',
    freight: 'Freight & insurance',
    port: 'Port costs',
    tax: 'Tax & royalties',
    inland: 'Inland transport',
    other: 'Other',
  };

  return (
    <div className="space-y-4">
      {/* Visual waterfall bar chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Price Waterfall</h3>

        <div className="space-y-1">
          {steps.map((step, i) => {
            const isMarker = step.amount === 0 && step.label.startsWith('=');
            const barWidth = (step.subtotal / cifPrice) * 100;

            return (
              <div key={i} className={`flex items-center gap-3 ${isMarker ? 'py-2 border-t border-gray-700' : 'py-0.5'}`}>
                <div className="w-36 flex-shrink-0 text-right">
                  <span className={`text-xs ${isMarker ? 'text-white font-semibold' : 'text-gray-400'}`}>
                    {step.label}
                  </span>
                </div>

                {!isMarker && (
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 h-4 bg-gray-800 rounded-full overflow-hidden relative">
                      <div
                        className={`h-full rounded-full transition-all ${
                          step.amount > 0 ? 'bg-emerald-500/60' :
                          categoryColors[step.category] || 'bg-gray-500'
                        }`}
                        style={{ width: `${Math.max(barWidth, 2)}%` }}
                      />
                    </div>
                    <span className={`text-xs w-20 text-right flex-shrink-0 ${
                      step.amount > 0 ? 'text-emerald-400' : step.amount < 0 ? 'text-red-400' : 'text-gray-400'
                    }`}>
                      {step.amount > 0 ? '+' : ''}{step.amount !== 0 ? `$${step.amount.toFixed(2)}` : ''}
                    </span>
                  </div>
                )}

                {isMarker && (
                  <div className="flex-1 flex items-center gap-2">
                    <span className="text-sm font-bold text-amber-400">${step.subtotal.toFixed(2)}/t</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-gray-800">
          <div>
            <p className="text-xs text-gray-500">CIF</p>
            <p className="text-lg font-bold text-white">${waterfall.cifPrice.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">FOB</p>
            <p className="text-lg font-bold text-amber-400">${waterfall.fobPrice.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Mine Gate</p>
            <p className="text-lg font-bold text-emerald-400">${waterfall.fcaMineGatePrice.toFixed(2)}</p>
          </div>
        </div>

        {margin && (
          <div className="mt-3 pt-3 border-t border-gray-800 flex items-center gap-3">
            <span className="text-xs text-gray-500">Estimated margin:</span>
            <span className={`text-sm font-bold ${margin.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              ${margin.amount.toFixed(2)}/t ({margin.percentage.toFixed(1)}%)
            </span>
          </div>
        )}
      </div>

      {/* Detailed breakdown table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-xs text-gray-500">
              <th className="px-4 py-2 text-left font-medium">Component</th>
              <th className="px-4 py-2 text-right font-medium">$/t</th>
              <th className="px-4 py-2 text-right font-medium">Subtotal</th>
              <th className="px-4 py-2 text-left font-medium">Note</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((step, i) => {
              const isMarker = step.amount === 0 && step.label.startsWith('=');
              return (
                <tr key={i} className={`border-b border-gray-800/50 ${isMarker ? 'bg-gray-800/30' : ''}`}>
                  <td className={`px-4 py-2 ${isMarker ? 'font-semibold text-white' : 'text-gray-300'}`}>
                    <div className="flex items-center gap-2">
                      {!isMarker && (
                        <span className={`w-2 h-2 rounded-full ${categoryColors[step.category]}`} />
                      )}
                      {step.label}
                    </div>
                  </td>
                  <td className={`px-4 py-2 text-right ${
                    step.amount > 0 ? 'text-emerald-400' : step.amount < 0 ? 'text-red-400' : ''
                  } ${isMarker ? 'font-bold text-amber-400' : ''}`}>
                    {step.amount !== 0 ? `${step.amount > 0 ? '+' : ''}${step.amount.toFixed(2)}` : ''}
                  </td>
                  <td className={`px-4 py-2 text-right ${isMarker ? 'font-bold text-amber-400' : 'text-gray-400'}`}>
                    ${step.subtotal.toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-500">{step.note}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Category legend */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
        {Object.entries(categoryLabels).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${categoryColors[key]}`} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
