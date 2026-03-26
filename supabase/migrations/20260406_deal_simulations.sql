CREATE TABLE IF NOT EXISTS deal_simulations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  commodity TEXT NOT NULL,
  commodity_subtype TEXT,
  mine_gate_price NUMERIC NOT NULL,
  volume_tonnes NUMERIC NOT NULL,
  loading_port TEXT,
  destination TEXT,
  transport_mode TEXT,
  cif_result NUMERIC,
  margin_result NUMERIC,
  index_price_used NUMERIC,
  financing_included BOOLEAN DEFAULT false,
  hedging_included BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deal_simulations_commodity ON deal_simulations(commodity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deal_simulations_user ON deal_simulations(user_id);

ALTER TABLE deal_simulations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own simulations" ON deal_simulations FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can create simulations" ON deal_simulations FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
