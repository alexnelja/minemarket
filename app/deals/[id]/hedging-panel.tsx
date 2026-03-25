'use client';

interface HedgingPanelProps {
  dealCurrency: string;
  agreedPrice: number;
  volumeTonnes: number;
  commodity: string;
}

export function HedgingPanel({ dealCurrency, agreedPrice, volumeTonnes, commodity }: HedgingPanelProps) {
  const totalValue = agreedPrice * volumeTonnes;
  const fxExposure = dealCurrency !== 'USD' ? totalValue : 0;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Risk & Hedging</h2>
        <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">In Development</span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs text-gray-500">Deal Value</p>
          <p className="text-sm text-white font-medium">{dealCurrency} {totalValue.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">FX Exposure</p>
          <p className={`text-sm font-medium ${fxExposure > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {fxExposure > 0 ? `${dealCurrency} ${fxExposure.toLocaleString()}` : 'None (USD deal)'}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Price Risk</p>
          <p className="text-sm text-gray-400">±5% = {dealCurrency} {Math.round(totalValue * 0.05).toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Commodity</p>
          <p className="text-sm text-white capitalize">{commodity.replace('_', ' ')}</p>
        </div>
      </div>

      <div className="border-t border-gray-800 pt-4 space-y-2">
        <p className="text-xs text-gray-500">Hedging tools coming soon:</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { name: 'FX Forward', desc: 'Lock exchange rate for settlement' },
            { name: 'Price Collar', desc: 'Set floor and ceiling on commodity price' },
            { name: 'Freight Hedge', desc: 'Fix shipping costs via FFA' },
            { name: 'Credit Insurance', desc: 'Protect against buyer default' },
          ].map(tool => (
            <div key={tool.name} className="bg-gray-950 border border-gray-800 rounded-lg p-3 opacity-50">
              <p className="text-xs font-medium text-gray-300">{tool.name}</p>
              <p className="text-[10px] text-gray-600 mt-0.5">{tool.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
