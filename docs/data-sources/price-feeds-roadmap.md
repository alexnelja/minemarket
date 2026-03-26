# Commodity Price Feeds — Roadmap

## Currently Implemented (Free)

| Source | Commodities | Frequency | Cost |
|---|---|---|---|
| LBMA | Gold, Platinum, Palladium, Silver | Daily | Free |
| World Bank Pink Sheet | Iron ore, coal (monthly) | Monthly | Free |
| FRED/IMF | Iron ore 62% CFR, Coal AU/SA | Monthly | Free |
| Platform averages | All 10 commodities | Per-deal | Free |
| Trading Economics (scraper) | Iron ore, coal, gold, Pt, Cu, Ni | Daily | Free |
| SMM/metal.com (scraper) | Chrome ore, Mn ore, FeCr, V₂O₅ | Daily | Free |

## Phase 2 — Cheap ($50-200/month)

| Source | Commodities | What It Adds | Est. Cost |
|---|---|---|---|
| Trading Economics API | All metals + energy | Clean JSON API, no scraping needed | $50/month |
| Asian Metal | Chrome, Mn, V, Ti — Chinese port prices | Most comprehensive for our niche commodities | $100-250/month |

## Phase 3 — Medium ($500-3,000/year)

| Source | Commodities | What It Adds | Est. Cost |
|---|---|---|---|
| Argus Metals | FeCr, Mn alloys, V₂O₅ | Benchmark assessments for alloys | $3-8K/year |
| CRU Group | Chrome, Mn, Fe alloys | Cost curves, supply/demand forecasts | $3-10K/year |
| Ship & Bunker | VLSFO/MGO bunker prices | Improves freight calculator accuracy | $500-1K/year |

## Phase 4 — Premium ($5,000+/year)

| Source | Commodities | What It Adds | Est. Cost |
|---|---|---|---|
| Fastmarkets (Metal Bulletin) | Chrome 42%, Mn 37/44%, V₂O₅, FeCr | Industry benchmark pricing | $5-15K/year |
| Platts (S&P Global) | Iron ore, coal, some alloys | Most widely referenced indices | $5-15K/year |
| S&P Global Market Intelligence | All — mine-level production data | Per-mine costs, reserves, ownership | $10-30K/year |
| Bloomberg Terminal | Everything | Real-time, institutional-grade | $24K+/year |

## Phase 5 — Via BSEC Partnership

| Data | What BSEC Provides | Cost |
|---|---|---|
| Live FX forward rates (USD/ZAR) | Replace static 3.25% estimate | Partnership |
| OTC commodity swap pricing | Chrome, Mn, V quotes | Partnership |
| LC pricing / trade finance rates | For trade finance feature | Partnership |
