# MineMarket

## Overview

Next.js 16 (React 19) application backed by Supabase (Postgres + PostGIS + Auth) and deployed on Vercel. This is the primary web surface for **MineMarket**, Alex's South African bulk minerals trading platform — chrome, manganese, iron ore, coal, aggregates, and precious/base metals (platinum, gold, copper, vanadium, titanium). Provides deal origination, supply-chain visualization, lab assay handling, reverse-waterfall pricing, route optimization, vessel/port tracking, and trading-desk tooling. Tightly aligned with the BSEC hedging / trade-finance / escrow partnership scope.

## Status

Deployed on Vercel with a daily cron (`/api/cron/refresh` at 06:00 UTC). Supabase-auth enforced via `middleware.ts` — all routes are private except the public marketing/tooling surfaces (`/login`, `/signup`, `/simulator`, `/lab`, and several public API endpoints).

Current routes (from `app/`):
- `(auth)` — login / signup
- `dashboard` — landing after auth (redirects to `/deals`)
- `deals` — deal pipeline, P&L tracker, global search (Cmd+K), platform-native e-sign
- `marketplace` / `market` — listings surface
- `contracts` — Contract Book
- `positions` — Position Book
- `trading` — trading desk
- `simulator` — public reverse-waterfall deal simulator (sell price in → breakeven buy price out)
- `scenarios` — saved simulation scenarios
- `lab` — public lab assay upload portal + structured parsing
- `map` — Mapbox-based route/port/vessel map
- `vessels` — vessel-position tracking
- `intelligence` — market intelligence queries
- `api` — REST endpoints (waterfall, routes, sea-route, distance, price-estimate, marine-weather, deal-simulator, auth callback, cron refresh, lab-upload)

## Setup & Run

Requires Node 20+ and `npm`.

```bash
npm install
npm run dev       # next dev
npm run build
npm run start
npm test          # vitest
```

### Environment variables

Create `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...       # server-side writes / cron
NEXT_PUBLIC_MAPBOX_TOKEN=...        # map, vessels, route pages
```

### Database

1. In the Supabase SQL editor, run `supabase-setup.sql` (original Plan-1 schema, PostGIS + enums + core tables).
2. Apply every migration in `supabase/migrations/` in order — these add vessel_positions, port_congestion, rail_stations/segments, commodity_prices, deal_messages, kyc_documents, verification_requests, deal_simulations, plus additional commodity subtypes, document types, RLS, and triggers.
3. Seed with whichever fits your environment:
   - `seed-data.sql` — minimal
   - `seed-data-examples.sql` — illustrative listings
   - `seed-data-full.sql` — full fixture set
   - `seed-deals.sql` — deal-pipeline fixtures

### Data ingestion scripts (`scripts/`)

```bash
npm run ingest:all          # ICMM mines + UNLOCODE ports + verify
npm run ingest:rails        # Africa rails (Transnet etc.)
npm run ingest:prices       # commodity prices
npm run ingest:lbma         # LBMA precious metals
npm run ingest:fred         # FRED economic series
npm run scrape:all          # Trading Economics + SMM + FRED
npm run collect:vessels     # 30-min AIS collection window
npm run enrich:mines        # fine-print enrichment
npm run calculate:congestion
```

## Architecture

```
app/                 # Next.js App Router (routes listed above)
  api/               # server routes — waterfall, routes, auth, cron, lab-upload, ...
  components/        # shared UI
  layout.tsx, sidebar.tsx, page.tsx
lib/                 # domain + data layer
  supabase.ts, supabase-server.ts, auth.ts, admin.ts
  price-engine.ts, price-waterfall.ts, reverse-waterfall.ts, forward-waterfall.ts
  route-optimizer.ts, sea-routes.ts, distance.ts, marine-weather.ts
  deal-helpers.ts, deal-queries.ts, spec-comparison.ts, spec-fields.ts
  lab-upload-parse.ts, lab-summary.ts, lab-notification-email.ts
  trust-score.ts, trust-queries.ts, document-verification.ts, platform-verification.ts
  commodity-prices.ts, commodity-corridors.ts, commodity-subtypes.ts
  vessel-queries.ts, rail-queries.ts, transnet-rail.ts, intelligence-queries.ts
  esign.ts, supply-chain-timeline.ts, types.ts, constants.ts
  __tests__/         # vitest unit tests (lab parser, timeline, etc.)
middleware.ts        # Supabase-auth route guard + public-route allow-list
supabase/migrations/ # canonical schema evolution
supabase-setup.sql   # original Plan-1 schema (run first)
seed-*.sql           # seed fixtures
scripts/             # ingestion / scraping / enrichment CLIs
docs/                # ARCHITECTURE.md, ONBOARDING.md, data-sources/, superpowers/
vercel.json          # daily cron at 06:00 UTC -> /api/cron/refresh
vitest.config.ts     # test runner
```

Key design choices (from recent commits):
- Reverse-waterfall simulator is the pricing core: sell price in → breakeven buy price out.
- Segmented supply-chain timeline is wired to real platform data.
- Route optimizer ranks all origin-port/destination combinations by margin.
- Lab uploads parse into structured assay data, drive spec comparison, and surface in deal verification.
- Data-source attribution, freshness indicators, and accuracy flags are first-class.

## Roadmap

- [ ] Phase 3 external-API integrations for the timeline engine (see `docs/` / commit `2d5b05d`)
- [ ] Expand commodity coverage beyond current chrome/manganese-led focus into full platinum/gold/copper/vanadium/titanium surfaces
- [ ] BSEC hedging / trade-finance / escrow integration points (platform-native signing already landed)
- [ ] Continue audit-driven UX polish (skeletons, loading states, mobile corridor view — prior rounds in `970a7a4`, `e2c460a`, `f004367`)

## Known Bugs

- None identified in code (no `TODO` / `FIXME` markers in `app/` or `lib/`). Track new issues in `BUGS.md`.
