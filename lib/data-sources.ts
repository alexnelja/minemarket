export type DataQuality = 'published' | 'calculated' | 'estimated' | 'placeholder';

export interface DataSource {
  id: string;
  name: string;
  quality: DataQuality;
  url?: string;
  updateFrequency: string;    // 'daily' | 'weekly' | 'monthly' | 'annual' | 'static'
  lastUpdated?: string;       // ISO date or null
  note: string;
  upgradeAvailable?: string;  // What paid source could replace this
}

// Quality badges for UI
export const QUALITY_BADGES: Record<DataQuality, { label: string; color: string; bgColor: string; borderColor: string }> = {
  published: { label: 'Published', color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/20' },
  calculated: { label: 'Calculated', color: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/20' },
  estimated: { label: 'Estimated', color: 'text-amber-400', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/20' },
  placeholder: { label: 'Placeholder', color: 'text-red-400', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/20' },
};

// Map DataQuality → QualityBadge variant for use with <QualityBadge>
export const QUALITY_VARIANT: Record<DataQuality, 'green' | 'blue' | 'amber' | 'red'> = {
  published: 'green',
  calculated: 'blue',
  estimated: 'amber',
  placeholder: 'red',
};

export const DATA_SOURCES: Record<string, DataSource> = {
  // Commodity prices
  lbma_gold: { id: 'lbma_gold', name: 'LBMA Gold Price', quality: 'published', url: 'https://www.lbma.org.uk/prices-and-data', updateFrequency: 'daily', note: 'Official daily fix — benchmark for global gold trading' },
  lbma_platinum: { id: 'lbma_platinum', name: 'LBMA Platinum Price', quality: 'published', url: 'https://www.lbma.org.uk/prices-and-data', updateFrequency: 'daily', note: 'Official daily fix' },
  lbma_palladium: { id: 'lbma_palladium', name: 'LBMA Palladium Price', quality: 'published', url: 'https://www.lbma.org.uk/prices-and-data', updateFrequency: 'daily', note: 'Official daily fix' },
  lbma_silver: { id: 'lbma_silver', name: 'LBMA Silver Price', quality: 'published', url: 'https://www.lbma.org.uk/prices-and-data', updateFrequency: 'daily', note: 'Official daily fix' },
  world_bank: { id: 'world_bank', name: 'World Bank Pink Sheet', quality: 'published', url: 'https://www.worldbank.org/en/research/commodity-markets', updateFrequency: 'monthly', note: 'Monthly averages — 1-2 month lag', upgradeAvailable: 'Commodities-API ($20/mo) for daily iron ore + coal' },
  comex_delayed_yahoo: { id: 'comex_delayed_yahoo', name: 'COMEX Futures (Yahoo)', quality: 'published', url: 'https://finance.yahoo.com/quote/HG%3DF', updateFrequency: 'daily', note: 'Daily close from Yahoo Finance chart API — COMEX copper (HG=F). Delayed ~15m. Tracks LME copper to within ~0.5%, used as a daily proxy.', upgradeAvailable: 'LME Real-Time feed or Bloomberg for official LME settle' },
  fred: { id: 'fred', name: 'FRED (Federal Reserve)', quality: 'published', url: 'https://fred.stlouisfed.org/', updateFrequency: 'monthly', note: 'IMF data via FRED — monthly', upgradeAvailable: 'Platts IODEX ($5-15K/yr) for daily iron ore' },
  smm: { id: 'smm', name: 'SMM/Metal.com', quality: 'published', url: 'https://www.metal.com/', updateFrequency: 'daily', note: 'Shanghai Metals Market — daily Chinese port prices' },
  trading_economics: { id: 'trading_economics', name: 'Trading Economics', quality: 'published', url: 'https://tradingeconomics.com/commodities', updateFrequency: 'daily', note: 'Aggregated from multiple exchanges' },
  platform_avg: { id: 'platform_avg', name: 'MineMarket Platform', quality: 'calculated', updateFrequency: 'daily', note: 'Average of completed deals on the platform (last 90 days)' },
  benchmark: { id: 'benchmark', name: 'Industry Benchmark', quality: 'estimated', updateFrequency: 'static', note: 'Estimated from industry reports — not a live price', upgradeAvailable: 'Fastmarkets ($5-15K/yr) for weekly assessments' },

  // Chrome-specific
  chrome_price: { id: 'chrome_price', name: 'Chrome Ore Price', quality: 'estimated', updateFrequency: 'daily', note: 'SMM scraper or platform average. No free published daily index for SA chrome.', upgradeAvailable: 'Fastmarkets chrome 42% CIF China ($5-15K/yr) or Asian Metal ($1-3K/yr)' },
  manganese_price: { id: 'manganese_price', name: 'Manganese Ore Price', quality: 'estimated', updateFrequency: 'daily', note: 'SMM scraper or platform average.', upgradeAvailable: 'CRU Mn ore index ($3-10K/yr)' },
  vanadium_price: { id: 'vanadium_price', name: 'Vanadium Price', quality: 'estimated', updateFrequency: 'daily', note: 'SMM scraper or benchmark.', upgradeAvailable: 'Metal Bulletin V₂O₅ ($5-15K/yr)' },
  titanium_price: { id: 'titanium_price', name: 'Titanium Price', quality: 'placeholder', updateFrequency: 'static', note: 'No free daily price source available. Using static benchmark.', upgradeAvailable: 'Fastmarkets TiO₂ feedstock ($5-15K/yr)' },

  // Port costs
  port_tariffs: { id: 'port_tariffs', name: 'Transnet Port Tariffs', quality: 'published', url: 'https://portsregulator.org/', updateFrequency: 'annual', note: 'TNPA/TPT Tariff Book 2025/26 — updated annually in April', lastUpdated: '2025-04-01' },

  // Inland transport
  transnet_rail: { id: 'transnet_rail', name: 'Transnet Rail Rates', quality: 'estimated', updateFrequency: 'annual', note: 'Based on published Mn ore rate (5.3c/gt-km). Actual rates negotiated per contract.', upgradeAvailable: 'Direct Transnet contract rates' },
  road_freight: { id: 'road_freight', name: 'Road Freight Estimate', quality: 'estimated', updateFrequency: 'static', note: 'Industry average R3.30/t/km for 30t side-tipper. Varies by route and fuel price.' },

  // Maritime
  bunker_fuel: { id: 'bunker_fuel', name: 'Bunker Fuel (VLSFO)', quality: 'placeholder', updateFrequency: 'static', note: 'Static $550/t estimate. Actual price varies daily by port.', upgradeAvailable: 'Ship & Bunker API ($500-1K/yr) for daily port-specific prices' },
  vessel_economics: { id: 'vessel_economics', name: 'Vessel Economics', quality: 'calculated', updateFrequency: 'static', note: 'TCE rates from industry averages. Actual rates depend on market conditions (BDI).' },
  sea_route: { id: 'sea_route', name: 'Sea Route Distance', quality: 'calculated', url: 'https://github.com/eurostat/searoute', updateFrequency: 'static', note: 'Computed via searoute-js (Eurostat). Follows shipping lanes.' },

  // Royalties & taxes
  mprra_royalty: { id: 'mprra_royalty', name: 'MPRRA Mineral Royalty', quality: 'estimated', url: 'https://www.sars.gov.za/types-of-tax/mineral-and-petroleum-resource-royalty/', updateFrequency: 'annual', note: 'Effective rates estimated from MPRRA formula. Actual rate depends on company profitability.' },

  // FX
  fx_hedge_cost: { id: 'fx_hedge_cost', name: 'FX Hedge Cost', quality: 'estimated', updateFrequency: 'static', note: 'Based on SARB/Fed interest rate differential (~3.25% p.a.). Actual forward rates vary.', upgradeAvailable: 'BSEC partnership for live forward rates' },

  // Vessels
  ais_vessels: { id: 'ais_vessels', name: 'AIS Vessel Positions', quality: 'published', url: 'https://aisstream.io/', updateFrequency: 'daily', note: 'Live AIS data. Ship type enrichment pending (79% unclassified).', upgradeAvailable: 'Datalastic vessel DB ($29-49/mo starter) for full enrichment' },
};

// Get source info for a commodity's price
export function getPriceSource(commodity: string, source?: string): DataSource {
  if (source === 'lbma') {
    const lbmaMap: Record<string, string> = { gold: 'lbma_gold', platinum: 'lbma_platinum', palladium: 'lbma_palladium', silver: 'lbma_silver' };
    return DATA_SOURCES[lbmaMap[commodity]] || DATA_SOURCES.benchmark;
  }
  if (source === 'world_bank' || source === 'fred') return DATA_SOURCES[source];
  if (source === 'comex_delayed_yahoo') return DATA_SOURCES.comex_delayed_yahoo;
  if (source === 'smm') return DATA_SOURCES.smm;
  if (source === 'trading_economics') return DATA_SOURCES.trading_economics;
  if (source === 'platform_avg' || source === 'platform_deals') return DATA_SOURCES.platform_avg;

  // Commodity-specific defaults
  const commodityDefaults: Record<string, string> = {
    chrome: 'chrome_price', manganese: 'manganese_price', vanadium: 'vanadium_price',
    titanium: 'titanium_price', aggregates: 'benchmark',
  };
  return DATA_SOURCES[commodityDefaults[commodity]] || DATA_SOURCES.benchmark;
}
