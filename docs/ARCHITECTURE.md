# MineMarket — Architecture Documentation

> Last updated: 2026-03-27

## Overview

MineMarket is a deal workspace and marketplace for bulk minerals, connecting SA mines, traders, and international buyers. Built with Next.js 16 (App Router), Supabase (PostgreSQL + PostGIS), and Mapbox GL JS.

**Repo:** github.com/alexnelja/minemarket

---

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, React 19) |
| Styling | Tailwind CSS v4 |
| Database | Supabase (PostgreSQL + PostGIS + RLS) |
| Auth | Supabase Auth (email/password) |
| Maps | Mapbox GL JS v3 |
| Charts | Lightweight-charts |
| Sea routes | searoute-js (Eurostat) |
| Email | Resend API |
| Weather | Open-Meteo Marine API |
| Vessels | AIStream (AIS positions) |
| Testing | Vitest (249 tests) |

---

## System Context

```
                    ┌──────────────┐
                    │   Trader     │
                    │  (Browser)   │
                    └──────┬───────┘
                           │
                    ┌──────┴───────┐
                    │  MineMarket  │
                    │  (Next.js)   │
                    └──────┬───────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
   ┌──────┴───────┐ ┌─────┴──────┐ ┌──────┴───────┐
   │   Supabase   │ │   Mapbox   │ │   Resend     │
   │ (PostgreSQL) │ │  (Maps)    │ │  (Email)     │
   └──────────────┘ └────────────┘ └──────────────┘
```

**Users:** Traders, mines, labs, brokers
**External services:** Supabase (data), Mapbox (maps), Resend (email), Open-Meteo (weather), AIStream (vessels)

---

## Page Routes

### Authenticated
| Route | Purpose |
|-------|---------|
| `/deals` | Deal pipeline and shipments |
| `/deals/[id]` | Deal workspace (docs, shipping, messages) |
| `/positions` | Open position/exposure tracker |
| `/contracts` | Contract library |
| `/marketplace` | Listings and requirements |
| `/marketplace/new-listing` | Create listing |
| `/marketplace/listings/[id]` | Listing detail |
| `/map` | Geographic map (mines, ports, vessels, corridors) |
| `/trading` | Price analytics and charts |
| `/vessels` | AIS vessel tracking |
| `/intelligence` | Market analytics (concentration, velocity, volume) |
| `/dashboard` | User dashboard |
| `/dashboard/kyc` | KYC document upload |
| `/scenarios` | Saved deal scenarios |

### Public (no login)
| Route | Purpose |
|-------|---------|
| `/simulator` | Deal simulator (reverse waterfall) |
| `/simulator/s/[token]` | Shared scenario (read-only) |
| `/lab` | Lab report upload portal |
| `/login`, `/signup` | Authentication |

---

## API Routes

### Public
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/reverse-waterfall` | GET | Reverse waterfall: sell price → breakeven buy price |
| `/api/deal-simulator` | GET | Forward waterfall simulation |
| `/api/optimize-routes` | GET | Compare transit port options |
| `/api/price-estimate` | GET | Quick price estimate |
| `/api/sea-route` | GET | Sea route distance + freight |
| `/api/distance` | GET | Haversine distance |
| `/api/marine-weather` | GET | Marine weather forecast |
| `/api/lab-upload` | POST | Lab report upload |
| `/api/scenarios/[id]` | GET | Shared scenario (by share_token) |

### Authenticated
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/deals` | POST | Create deal from listing |
| `/api/deals/[id]` | GET/PATCH | Deal detail + status transitions |
| `/api/deals/[id]/documents` | POST | Upload deal document |
| `/api/deals/[id]/milestones` | POST | Create shipping milestone |
| `/api/deals/[id]/messages` | POST | Send deal message |
| `/api/deals/[id]/sign` | POST | E-sign document |
| `/api/deals/[id]/invite` | POST | Invite counterparty (sends email) |
| `/api/deals/[id]/ratings` | POST | Rate counterparty |
| `/api/deals/[id]/verification-request` | POST/GET | Request verification |
| `/api/scenarios` | GET/POST | List/create scenarios |
| `/api/scenarios/[id]` | GET/PATCH/DELETE | Scenario CRUD |
| `/api/search` | GET | Global search |
| `/api/kyc` | POST | KYC submission |

---

## Core Modules (`lib/`)

### Pricing & Cost Calculation
| Module | Purpose |
|--------|---------|
| `shipping-constants.ts` | **Single source of truth** for port charges, royalties, transport rates, insurance |
| `reverse-waterfall.ts` | Sell price → subtract costs → breakeven buy price + verification checkpoints |
| `forward-waterfall.ts` | Buy price → add costs → sell price (with hedging, financing) |
| `price-waterfall.ts` | CIF → FOB reverse calculation with all SA-specific fees |
| `price-engine.ts` | Price estimation with grade/location/freshness adjustments |
| `commodity-prices.ts` | Fetch latest prices from Supabase |
| `route-optimizer.ts` | Compare routes: mine → multiple SA ports → destination |
| `sea-routes.ts` | Ocean freight via searoute-js (vessel economics, bunker costs) |

### Data & Types
| Module | Purpose |
|--------|---------|
| `types.ts` | All TypeScript interfaces (User, Deal, Listing, Mine, Harbour, etc.) |
| `commodity-subtypes.ts` | Grade definitions for 10 commodities (chrome, manganese, etc.) |
| `commodity-corridors.ts` | SA mining regions → port mappings |
| `data-sources.ts` | Metadata for 25+ data sources with quality ratings |
| `spec-fields.ts` | Spec field definitions (Cr₂O₃%, Mn%, Fe%, etc.) |

### Business Logic
| Module | Purpose |
|--------|---------|
| `deal-helpers.ts` | Deal state machine: 12 statuses with role-based transitions |
| `trust-score.ts` | Bayesian trust scoring (5 dimensions, 4 badge tiers) |
| `spec-comparison.ts` | Spec tolerance matching + price adjustments |
| `supply-chain-timeline.ts` | 28 SA rail routes, port operations, transit estimation |

---

## Authentication & Security

**Flow:**
1. User signs up/logs in via Supabase Auth (email/password)
2. `middleware.ts` checks session cookie on every request
3. Public routes bypass auth (simulator, lab, APIs)
4. Authenticated routes redirect to `/login` if no session
5. Server components use `createServerSupabaseClient()` (respects RLS)
6. Admin operations use `createAdminSupabaseClient()` (bypasses RLS, server-only)

**RLS Policies:**
- Users read/update own profile
- Listings: public read (active), seller can modify
- Deals: only buyer + seller can access
- Milestones/documents: inherited from deal participation
- Scenarios: user reads own + public reads via share_token

---

## Data Model

```
user ──→ listings (seller)
user ──→ requirements (buyer)
user ──→ deals (buyer or seller)
user ──→ ratings, kyc_documents

listing ──→ mine (source)
listing ──→ harbour (loading port)
listing ──→ deals

deal ──→ milestones, documents, messages, ratings
deal ──→ deal_scenarios (optional link)

mine ──→ routes ──→ harbour
```

**Key tables:** users, mines, harbours, listings, requirements, deals, deal_milestones, deal_documents, deal_messages, deal_ratings, commodity_prices, vessel_positions, port_congestion, deal_scenarios

---

## Simulator Architecture

The simulator is the public-facing analytical tool. It uses a **reverse waterfall** — trader enters sell price, system calculates breakeven buy price.

```
User Input                    Calculation                     Output
─────────                    ───────────                     ──────
Sell price ($315 CIF)   →    Subtract: insurance, discharge  →  Breakeven buy: $230/t
Commodity (Chrome 42%)  →    Subtract: ocean freight         →  Route comparison (5 options)
Origin (Steelpoort)     →    Subtract: royalty, port costs   →  Verification checkpoints
Destination (Qingdao)   →    Subtract: inland transport      →  Supply chain timeline
                             Subtract: hedging costs          →  Save as scenario
```

**Pre-computed data:**
- `public/data/rail-routes.json` — 48 mine→port rail routes with real geometries (NetworkX shortest path on 32K-feature rail network)
- `public/za-railways.geojson` — Full SA + Maputo Corridor rail network (28.8MB, HDX + Overpass)

**Cost constants** in `lib/shipping-constants.ts`:
- Port charges by terminal (TNPA tariffs)
- Commodity-specific handling multipliers (coal 0.80x → gold 2.50x)
- Transport multipliers by mode (rail vs road, per commodity)
- MPRRA royalty rates
- Road distance limits by commodity (chrome 900km, manganese 1100km)

---

## Deal State Machine

```
interest → first_accept → negotiation → second_accept →
escrow_held → loading → in_transit → delivered →
escrow_released → completed
```

Role-based transitions enforced in `lib/deal-helpers.ts`. FX rate locked at `second_accept`. Escrow status auto-updates with deal status.

---

## Data Ingestion

Scripts in `scripts/`:
- `ingest-icmm-mines.js` — Mine locations
- `ingest-unlocode-ports.js` — Port data
- `ingest-africa-rails.js` — Rail infrastructure
- `ingest-commodity-prices.js` — World Bank + FRED prices
- `ingest-lbma-prices.js` — LBMA precious metals (Au, Pt, Pd, Ag)
- `scrape-smm-metals.js` — Shanghai Metals Market (chrome, manganese)
- `collect-vessels.js` — AIS vessel positions
- `calculate-congestion.js` — Port queue times from AIS data
- `generate-rail-routes.py` — NetworkX shortest path on rail network → GeoJSON

---

## Testing

249 tests across 12 files (Vitest):
- `route-optimizer.test.ts` — 45 tests (FOB, CIF, CFR, Ngqura, grade, road limits)
- `forward-waterfall.test.ts` — Corridor pricing
- `supply-chain-timeline.test.ts` — Transit time estimation
- `sea-routes.test.ts` — Vessel economics
- `deal-helpers.test.ts` — State machine transitions
- `trust-score.test.ts` — Bayesian scoring
- `price-waterfall.test.ts` — CIF→FOB reverse
- `distance.test.ts` — Haversine calculation
- `spec-comparison.test.ts` — Grade tolerance matching
- `constants.test.ts` — Config validation
- `format.test.ts` — Currency/number formatting
- `price-engine.test.ts` — Price estimation

---

## Deployment

- **Hosting:** Vercel (automatic from `main` branch)
- **Database:** Supabase (hosted PostgreSQL)
- **Environment variables:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_MAPBOX_TOKEN`, `RESEND_API_KEY`
- **Migrations:** `supabase/migrations/` (11 migration files)
