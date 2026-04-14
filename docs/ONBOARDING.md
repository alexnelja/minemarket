# MineMarket — Developer Onboarding Guide

> Get from zero to first PR in under an hour.

## What is MineMarket?

A deal workspace for bulk minerals trading. Traders use it to:
1. **Simulate deals** — enter a sell price, see breakeven buy price across different routes
2. **Compare routes** — mine → SA port → international port, ranked by margin
3. **Manage deals** — negotiate, sign, ship, track payment
4. **Browse the market** — listings, prices, vessel positions, intelligence

Primary commodities: **chrome and manganese** from South Africa.

---

## Quick Start

```bash
# 1. Clone
git clone https://github.com/alexnelja/dashboard.git
cd dashboard

# 2. Install
npm install

# 3. Environment
cp .env.example .env.local
# Fill in: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_MAPBOX_TOKEN

# 4. Run
npm run dev
# → http://localhost:3000

# 5. Test
npx vitest run
# → 249 tests passing
```

### Required accounts
| Service | Purpose | Get access |
|---------|---------|------------|
| Supabase | Database, auth | Ask project owner for .env keys |
| Mapbox | Maps | Free account at mapbox.com |
| Vercel | Deployment | Linked to GitHub repo |

### Test credentials
```
Email: testbuyer@minemarket.test
Password: testpass123456
```

---

## Project Structure

```
dashboard/
├── app/                    # Next.js App Router pages & API routes
│   ├── (auth)/             # Login, signup (public)
│   ├── deals/              # Deal workspace
│   ├── marketplace/        # Listings & requirements
│   ├── simulator/          # Deal simulator (public)
│   ├── scenarios/          # Saved simulations
│   ├── map/                # Geographic map
│   ├── trading/            # Price analytics
│   ├── vessels/            # AIS vessel tracking
│   ├── api/                # API routes
│   ├── sidebar.tsx         # Main navigation
│   └── layout.tsx          # Root layout
├── lib/                    # Core business logic
│   ├── shipping-constants.ts  # Port charges, royalties, transport rates
│   ├── reverse-waterfall.ts   # Sell price → breakeven (main calculator)
│   ├── forward-waterfall.ts   # Buy price → sell price
│   ├── route-optimizer.ts     # Compare route options
│   ├── sea-routes.ts          # Ocean freight (searoute-js)
│   ├── deal-helpers.ts        # Deal state machine
│   ├── types.ts               # All TypeScript interfaces
│   ├── queries.ts             # DB queries (mines, harbours, listings)
│   └── __tests__/             # Vitest tests (249 tests)
├── public/
│   ├── data/rail-routes.json  # Pre-computed rail route geometries
│   └── za-railways.geojson   # SA rail network (28.8MB)
├── scripts/                # Data ingestion & generation
├── supabase/migrations/    # DB schema migrations
└── docs/                   # Documentation
```

---

## Key Concepts

### The Reverse Waterfall
The core feature. A trader enters their sell price (e.g., $315/t CIF Qingdao), and the system works **backwards** through all costs to show the maximum they can pay at the mine.

```
$315.00  Sell price (CIF)
 -0.47   Marine insurance
 -4.50   Discharge fees
-46.47   Ocean freight
 -7.91   MPRRA royalty (3%)
 -0.70   Surveyor & sampling
 -3.00   Stevedoring
 -4.00   Terminal handling
  ...    (more deductions)
────────
$230.14  Breakeven buy price at mine gate
```

**File:** `lib/reverse-waterfall.ts`

### Trade Points (Incoterms Corridor)
Every deal has a buy point and sell point along this corridor:

```
Mine Gate → Port Gate → FOB → CFR → CIF
  (EXW)      (FCA)             (destination)
```

Costs only apply between the buy and sell points. A FOB sale skips ocean freight and insurance.

### Commodity-Specific Costs
Not all commodities cost the same to handle. `lib/shipping-constants.ts` defines multipliers:

- Coal at Richards Bay: 0.80x handling (dedicated RBCT terminal)
- Chrome road to Maputo: 1.31x transport (border crossing, Moz tolls)
- Platinum: 1.80x handling (security requirements)

### Deal State Machine
```
interest → first_accept → negotiation → second_accept →
escrow_held → loading → in_transit → delivered →
escrow_released → completed
```

Role-based: only buyer can accept first, then seller, etc. FX rate locks at `second_accept`.

---

## How to Navigate the Code

### "I want to understand pricing"
1. Start at `lib/shipping-constants.ts` — all port charges, royalties, transport rates
2. Then `lib/reverse-waterfall.ts` — the main calculation
3. Then `lib/route-optimizer.ts` — how routes are compared
4. Test it: `curl "http://localhost:3000/api/reverse-waterfall?sell_price=315&commodity=chrome&sell_point=cif&mine_lat=-24.69&mine_lng=30.19&loading_port=Richards+Bay&loading_lat=-28.801&loading_lng=32.038&dest_lat=36.067&dest_lng=120.383"`

### "I want to understand deals"
1. Start at `lib/deal-helpers.ts` — state machine and transitions
2. Then `app/deals/[id]/page.tsx` — server component that loads deal data
3. Then `app/api/deals/[id]/route.ts` — API for status updates
4. Test: log in as testbuyer, go to `/deals`

### "I want to understand the map"
1. `app/map/map-client.tsx` — Mapbox GL JS, renders mines/ports/vessels/corridors
2. `app/simulator/route-map.tsx` — Smaller map for simulator route comparison
3. `public/data/rail-routes.json` — Pre-computed rail geometries
4. `scripts/generate-rail-routes.py` — How rail routes are generated (NetworkX)

### "I want to understand auth"
1. `middleware.ts` — public vs protected routes
2. `lib/supabase-server.ts` — server-side Supabase client (respects RLS)
3. `lib/auth.ts` — `requireAuth()` helper
4. `supabase-setup.sql` — RLS policies

---

## Development Workflow

### Running tests
```bash
npx vitest run                              # All 249 tests
npx vitest run lib/__tests__/route-optimizer # Single file
npx vitest --watch                          # Watch mode
```

### Type checking
```bash
npx tsc --noEmit
```

### Testing the simulator visually
```bash
# Write a Playwright script (see scripts/ for examples)
python3 scripts/with_server.py --server "npm run dev" --port 3000 -- python3 your_test.py
```

### Adding a new API route
1. Create `app/api/your-route/route.ts`
2. If public, add to `publicRoutes` in `middleware.ts`
3. Use `createServerSupabaseClient()` for auth-respecting queries
4. Use `createAdminSupabaseClient()` only when you need cross-user data

### Adding a new page
1. Create `app/your-page/page.tsx` (server component)
2. Create `app/your-page/your-client.tsx` with `'use client'` if interactive
3. Add to sidebar in `app/sidebar.tsx` (add icon function + nav item)

---

## Common Tasks

### Add a new SA port
1. Add to `LOADING_PORTS` in `lib/route-optimizer.ts`
2. Add charges to `PORT_CHARGES` in `lib/shipping-constants.ts`
3. Add to `COMMODITY_PORTS` mapping in `lib/route-optimizer.ts`
4. Add rail routes in `lib/supply-chain-timeline.ts` (`SA_RAIL_ROUTES`)
5. Run `python3 scripts/generate-rail-routes.py` to regenerate route geometries

### Add a new commodity
1. Add to `CommodityType` in `lib/types.ts`
2. Add to `COMMODITY_CONFIG` and `COMMODITY_PRICING` in `lib/types.ts`
3. Add handling/transport multipliers in `lib/shipping-constants.ts`
4. Add royalty rate in `lib/shipping-constants.ts`
5. Add port mapping in `lib/route-optimizer.ts` (`COMMODITY_PORTS`)
6. Add subtypes in `lib/commodity-subtypes.ts`

### Modify port charges
Edit **one file only:** `lib/shipping-constants.ts`. All waterfalls and optimizers import from there.

---

## Database

### Running migrations
```bash
# Migrations are in supabase/migrations/
# Apply via Supabase dashboard → SQL Editor, or:
supabase db push
```

### Key tables
| Table | Primary key | Key relationships |
|-------|-------------|-------------------|
| `users` | `id` (UUID, auth.users FK) | — |
| `mines` | `id` | PostGIS `location` |
| `harbours` | `id` | PostGIS `location`, `type` (loading/destination/both) |
| `listings` | `id` | → `users.id` (seller), → `mines.id`, → `harbours.id` |
| `deals` | `id` | → `listings.id`, → `users.id` (buyer + seller) |
| `deal_scenarios` | `id` | → `users.id`, optional → `deals.id`, `share_token` for public URLs |
| `commodity_prices` | `id` | `commodity`, `price_usd`, `source`, `recorded_at` |

---

## Troubleshooting

### "Page shows blank / 500 error"
Check Supabase connection. Most pages call DB in server components. If `.env.local` keys are wrong, all pages break.

### "Simulator shows error"
The simulator is public and works without auth. Check the API response:
```bash
curl "http://localhost:3000/api/reverse-waterfall?sell_price=315&commodity=chrome&sell_point=cif" | python3 -m json.tool
```

### "Tests fail after changing shipping constants"
Expected — many tests assert specific cost values. Update test expectations to match new rates.

### "Map doesn't show"
Check `NEXT_PUBLIC_MAPBOX_TOKEN` in `.env.local`. Free tier works.

### "za-railways.geojson is 28MB, slow to load"
It's loaded on-demand only by the map page and route-map component. The pre-computed `rail-routes.json` (656KB) is what the simulator uses.
