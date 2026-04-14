-- Deal scenarios: saved reverse waterfall simulations
-- Users can save, name, share, and convert scenarios to deals

CREATE TABLE IF NOT EXISTS deal_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identity
  name TEXT NOT NULL,
  share_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(12), 'hex'),

  -- Inputs
  commodity TEXT NOT NULL,
  commodity_subtype TEXT,
  grade NUMERIC,
  sell_price NUMERIC NOT NULL,
  sell_point TEXT NOT NULL DEFAULT 'cif',
  buy_point TEXT NOT NULL DEFAULT 'mine_gate',
  volume_tonnes NUMERIC NOT NULL DEFAULT 15000,

  -- Locations
  mine_name TEXT,
  mine_lat NUMERIC,
  mine_lng NUMERIC,
  loading_port TEXT,
  loading_port_lat NUMERIC,
  loading_port_lng NUMERIC,
  destination_name TEXT,
  destination_lat NUMERIC,
  destination_lng NUMERIC,

  -- Results
  breakeven_buy_price NUMERIC,
  total_costs NUMERIC,
  selected_route JSONB,        -- The route the user selected (port, transport mode, costs)
  all_routes JSONB,            -- All evaluated route options
  cost_breakdown JSONB,        -- Full reverse waterfall steps
  verification_checkpoints JSONB,

  -- Options
  transport_mode TEXT DEFAULT 'rail',
  fx_hedge TEXT DEFAULT 'spot',
  cost_overrides JSONB,        -- Manual cost overrides applied
  index_price_used NUMERIC,

  -- Metadata
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,  -- Linked deal (if converted)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for user lookup
CREATE INDEX IF NOT EXISTS idx_deal_scenarios_user ON deal_scenarios(user_id, created_at DESC);

-- Index for share token lookup (public access)
CREATE INDEX IF NOT EXISTS idx_deal_scenarios_share ON deal_scenarios(share_token) WHERE share_token IS NOT NULL;

-- RLS
ALTER TABLE deal_scenarios ENABLE ROW LEVEL SECURITY;

-- Users can read their own scenarios
CREATE POLICY "Users can read own scenarios"
  ON deal_scenarios FOR SELECT
  USING (auth.uid() = user_id);

-- Anyone can read shared scenarios (via share_token, checked in API)
CREATE POLICY "Public can read shared scenarios"
  ON deal_scenarios FOR SELECT
  USING (share_token IS NOT NULL);

-- Users can create scenarios
CREATE POLICY "Users can create scenarios"
  ON deal_scenarios FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own scenarios
CREATE POLICY "Users can update own scenarios"
  ON deal_scenarios FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own scenarios
CREATE POLICY "Users can delete own scenarios"
  ON deal_scenarios FOR DELETE
  USING (auth.uid() = user_id);
