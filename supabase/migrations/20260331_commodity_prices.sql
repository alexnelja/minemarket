-- Commodity spot prices: World Bank index + platform-derived benchmarks
CREATE TABLE IF NOT EXISTS commodity_prices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  commodity TEXT NOT NULL,
  price_usd NUMERIC NOT NULL,
  unit TEXT DEFAULT 'per_tonne',
  source TEXT NOT NULL,
  period TEXT,
  recorded_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commodity_prices_commodity ON commodity_prices(commodity, recorded_at DESC);

ALTER TABLE commodity_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read commodity prices" ON commodity_prices FOR SELECT USING (true);
