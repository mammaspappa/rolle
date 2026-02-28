# Rolle — Luxury Retailer Inventory System
## Project Plan & Progress

---

## What This System Does

A web-based inventory management system for a luxury retailer with:
- **1 central warehouse** (Lyon, France)
- **20 global stores** (Paris, NYC, London, Tokyo, Dubai, Hong Kong, Milan, Singapore, LA, Shanghai, Zurich, Seoul, Sydney, Berlin, Madrid, São Paulo, Riyadh, Miami, Toronto, Moscow)

**Core goal:** Keep supply and demand in balance as cost-efficiently as possible — prevent stockouts (lost sales) and minimize overstock (capital tied up in unsold luxury goods).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Database | PostgreSQL 16 |
| ORM | Prisma 5 |
| Auth | NextAuth v4 (credentials) |
| Background jobs | BullMQ + Redis 7 |
| UI components | shadcn/ui + Tailwind CSS |
| Charts | Recharts (coming in Phase 4) |
| Email alerts | Resend |
| Validation | Zod |

---

## Full Feature Plan

### Module 1 — Product Catalog
CRUD for products and variants (size/color). CSV bulk import. When a variant is created, stock rows are automatically seeded at all 21 locations.

### Module 2 — Real-Time Stock Levels
Stock grid: every SKU × every location. Color-coded by Days of Stock. Live updates via Server-Sent Events.

### Module 3 — Inbound/Outbound Tracking
- Purchase Order receiving (line-by-line, partial receipts supported)
- Sales recording via CSV upload or POS webhook
- Physical stock count and correction workflow

### Module 4 — Transfer Orders
Move stock between any two locations. Full approval workflow:
`DRAFT → REQUESTED → APPROVED → IN_TRANSIT → COMPLETED`

### Module 5 — Purchase Orders
Order stock from suppliers. Multi-currency support. Tracks lead times.

### Module 6 — Demand Forecasting
Nightly background job forecasts weekly demand per SKU per store using:
- Weighted Moving Average (12-week window, default)
- Exponential Smoothing (configurable alpha)
- Manual override by store managers

### Module 7 — Reorder Point & Safety Stock
Automatically calculates when to reorder and how much buffer stock to hold:
```
Safety Stock = Z × σ_demand × √(leadTimeWeeks)   [Z=1.65 for 95% service level]
Reorder Point = (avgWeeklyDemand × leadTimeWeeks) + safetyStock
```
When triggered: auto-creates draft Purchase Orders (warehouse) or Transfer Orders (stores).

### Module 8 — Allocation Engine
When warehouse stock is insufficient for all requesting stores, scores each store by urgency and allocates fairly. Presents a **proposal** for human approval — never auto-executes.

Priority scoring:
```
score = (below safety stock ? +1000 : 0)
      + (1 / daysOfStock) × 100        ← urgency
      + revenueTierWeight × 10          ← A=30, B=20, C=10
```

### Module 9 — Cost Tracking
Nightly carrying cost snapshots per SKU per location:
```
Daily Carrying Cost = quantity × unitCost × (annualRate / 365)
Annual rate: 20–35% depending on category (luxury goods)
```

### Module 10 — KPI Dashboard
| KPI | Formula |
|-----|---------|
| Fill Rate | units shipped ÷ units requested × 100 |
| Inventory Turnover | COGS ÷ avg inventory value (12-month rolling) |
| Days of Stock | quantity ÷ avg daily sales |
| Overstock Ratio | qty with DOS > 90 days ÷ total qty |
| GMROI | gross margin ÷ avg inventory cost |

### Module 11 — Alerts
| Type | Trigger | Severity |
|------|---------|----------|
| STOCKOUT | on-hand = 0 and forecast > 0 | 🔴 Critical |
| LOW_STOCK | available < safety stock | 🟡 Warning |
| REORDER_TRIGGERED | available ≤ reorder point | 🟡 Warning |
| OVERSTOCK | DOS > 90 days | 🔵 Info |
| DELAYED_SHIPMENT | PO/TO past expected arrival | 🟡 Warning |
| TRANSFER_OVERDUE | TO in transit 3+ days late | 🔴 Critical |

Critical alerts trigger email notifications.

---

## Build Phases

### ✅ Phase 1 — Foundation (Weeks 1–3)
*Goal: Working app skeleton with auth, database, and core data entry*

- [x] Next.js 14 project initialized
- [x] PostgreSQL + Redis via Docker
- [x] Complete Prisma schema (17 models, all relations and indexes)
- [x] Database migration applied
- [x] Seed data: 21 locations, demo products, admin user
- [x] NextAuth credentials login with RBAC
- [x] Route protection middleware
- [x] Base UI shell — sidebar, header with alert bell + user menu, dashboard layout
- [x] Login page (`/login`)
- [x] Dashboard home — KPI cards (locations, products, units on hand, open alerts), recent alerts panel
- [x] Locations page (`/locations`) — full table with tier, currency, units on hand
- [x] Products page (`/products`) — grouped by brand, stockout badges
- [x] Product detail page (`/products/[id]`) — variants with per-location stock breakdown
- [x] Inventory stock grid (`/inventory`) — all variants × all 21 locations, color-coded cells
- [x] Alerts page (`/alerts`) — grouped by severity, message + location + product info
- [x] Suppliers page (`/suppliers`) — supplier list with lead times and product counts
- [x] User management (`/settings`) — list users, add user, change role/location, deactivate/reactivate
- [x] Product CRUD — `/products/new` create form, add variant form on detail page (auto-seeds 21 InventoryLevel rows)
- [x] Supplier CRUD — inline dialog for add/edit on `/suppliers`
- [x] CSV bulk product import (`/products/import`) — upserts products + variants, template download

### ✅ Phase 2 — Core Inventory Operations (Weeks 4–7)
*Goal: Accurate stock tracking end-to-end*

- [x] `recordStockMovement()` — atomic Prisma transaction (StockMovement ledger + InventoryLevel dual-write)
- [x] Stock grid (`/inventory`) — all variants × 21 locations, color-coded by quantity
- [x] Purchase Order lifecycle — create (`/purchase-orders/new`), advance status (Draft→Sent→Confirmed), line-by-line receipt, cancel
- [x] Transfer Order lifecycle — create, approve (reserves stock), ship (deducts + in-transit), receive, cancel
- [x] Manual stock adjustments (`/inventory/adjustments`) — positive/negative delta, logged as ADJUSTMENT movement
- [x] Physical count workflow (`/inventory/count`) — export CSV, enter actuals, auto-generates COUNT_CORRECTION movements

### ✅ Phase 3 — Demand Engine & Replenishment (Weeks 8–11)
*Goal: System tells you what to order and when*

- [x] Sales data ingestion — CSV upload (`/inventory/sales-import`) + POS webhook (`POST /api/webhooks/pos`)
- [x] Nightly demand forecasting job — `server/services/forecasting.service.ts` + BullMQ job + `/forecasts` page
- [x] Safety stock + reorder point calculations — `server/services/safety-stock.service.ts`
- [x] Auto-draft POs and TOs on reorder trigger — `server/jobs/reorder-check.job.ts`
- [x] Allocation engine UI — `/allocation` page with scoring, proposal table, create-TOs button
- [x] BullMQ worker — `server/jobs/worker.ts` (run with `npm run worker`)
- [x] Manual job trigger — `POST /api/jobs/trigger?job=demand-forecast|reorder-check` (admin only)

### ✅ Phase 4 — Cost Tracking & KPI Dashboard (Weeks 12–14)
*Goal: Financial visibility into inventory health*

- [x] Nightly carrying cost snapshots — `server/services/cost-snapshot.service.ts` + BullMQ job
- [x] KPI calculations — `server/services/kpi.service.ts` (fill rate, turnover, DOS, overstock ratio, GMROI)
- [x] Full dashboard — 8 KPI cards + 4 charts (health bands, sales vs forecast, inventory value by location, carrying cost trend)
- [x] Charts (Recharts) — `components/charts/` (InventoryHealthChart, SalesForecastChart, InventoryValueChart, CarryingCostChart)
- [x] Alert management — resolve individual alerts or all, reorder check button on alerts page
- [x] Email notifications — `server/services/alert.service.ts` (Resend integration, CRITICAL alert emails)
- [x] Reports page (`/reports`) — cost by location table, carrying cost trend, category rates, health breakdown

### ✅ Phase 5 — Polish & Performance (Weeks 15–17)
*Goal: Production-ready*

- [x] Redis caching for stock grid — `lib/cache.ts` (60-second TTL, auto-invalidated on every mutation)
- [x] Mobile-responsive layout — `AppShell` component with hamburger drawer, auto-closes on route change
- [x] `Header` updated with `onMenuToggle` prop + mobile hamburger button (`lg:hidden`)
- [x] `app/(dashboard)/layout.tsx` refactored to use `AppShell`
- [x] `loading.tsx` skeleton screens — dashboard, inventory, products, reports, forecasts, alerts, transfer-orders, purchase-orders, locations
- [x] `error.tsx` error boundary — `app/(dashboard)/error.tsx` for graceful error recovery across all dashboard routes
- [x] `app/not-found.tsx` — 404 page
- [x] `components/ui/skeleton.tsx` — shadcn-style animated skeleton primitive
- [x] Inventory grid search/filter — client-side filter by brand/SKU/color/size in `InventoryTable.tsx`; totals row updates with filter
- [x] Location detail page — `/locations/[id]` with KPI strip, stock-level table with 30-day DOS, recent movement ledger
- [x] Locations list linked to detail page (code + name are clickable links)
- [ ] Query optimization (`EXPLAIN ANALYZE` + index tuning)
- [ ] Monitoring (Sentry)
- [ ] Onboarding flow
- [x] **Forecasting algorithm selector** — see plan below

#### Forecasting Algorithm Selector — Implementation Plan

**Goal:** Replace the current hardwired WMA call in `runDemandForecasting()` with a
`selectAlgorithm()` dispatcher that chooses the most appropriate method per SKU per
location, or accepts an explicit override from the UI.

**Key function signature (to be added to `forecasting.service.ts`):**
```typescript
type ForecastAlgorithm = 'WMA' | 'HOLT_WINTERS' | 'CROSTON_SBC' | 'ENSEMBLE';

function selectAlgorithm(
  weeklyHistory: number[],            // oldest → newest
  options?: { force?: ForecastAlgorithm }
): ForecastAlgorithm
```

Auto-selection rules (applied when no override is given):
- `zeroWeekRate > 0.5` → `CROSTON_SBC` (majority of weeks have no sales — intermittent demand)
- `weeklyHistory.length >= 26` → `HOLT_WINTERS` (enough data for seasonal fitting)
- otherwise → `WMA` (safe fallback for new/sparse products)
- `ENSEMBLE` is only invoked when explicitly forced or as future default once MAPE
  baselines have accumulated for ≥ 8 weeks

---

##### Algorithm 1 — Weighted Moving Average (WMA) · *already implemented*
*Complexity: minimal · data required: ≥ 2 weeks*

```
forecast = Σ(sales[i] × weight[i]) / Σ(weight[i])
weight[i] = i + 1   (oldest = 1, newest = n)
window = 12 weeks
```

- Simplest possible recency bias — recent weeks count more than older ones
- No trend or seasonality awareness
- Best for: new products with short history; stable, low-volume SKUs
- Current behaviour: this is the only algorithm called; confidence interval uses ±1 stddev
- Hyperparameters: `windowWeeks` (default 12)

---

##### Algorithm 2 — Holt-Winters Triple Exponential Smoothing · *additive seasonal model*
*Complexity: O(n · seasonLength) · data required: ≥ 2 full seasonal cycles (≥ 26 weeks)*

```
Level:    L_t = α(D_t - S_{t-m})  + (1 - α)(L_{t-1} + T_{t-1})
Trend:    T_t = β(L_t - L_{t-1})  + (1 - β)T_{t-1}
Seasonal: S_t = γ(D_t - L_{t-1} - T_{t-1}) + (1 - γ)S_{t-m}
Forecast: F_{t+h} = L_t + h·T_t + S_{t+h-m}
```

- Captures the December holiday spike (+95% vs baseline) and January dip that dominate
  luxury retail — features the current WMA completely ignores
- Additive form suits weekly series where seasonal swings are roughly constant in
  absolute units (not percentage), appropriate for low-volume luxury goods
- Seasonal period `m = 13` (quarterly, 4 × 13 = 52 weeks) works well with 26 weeks
  of history; upgrade to `m = 52` (annual) once 2+ years of data exist
- Confidence interval: propagate forecast error variance across the horizon
- Hyperparameters: `α` (level smoothing, default 0.2), `β` (trend, default 0.1),
  `γ` (seasonal, default 0.3), `seasonLength` (default 13)
- Init strategy: first `m` observations seed the seasonal indices; level init = mean
  of first cycle; trend init = 0
- New `ForecastMethod` enum value needed: `HOLT_WINTERS`

---

##### Algorithm 3 — Croston's Method with Syntetos-Boylan Correction (SBC) · *intermittent demand*
*Complexity: O(n) · data required: ≥ 4 non-zero observations*

```
On each non-zero demand observation at time t:
  z_t = α · D_t + (1 - α) · z_{t-1}    ← smoothed demand size
  q_t = α · p_t + (1 - α) · q_{t-1}    ← smoothed inter-demand interval
  p_t = periods since last non-zero sale

SBC bias correction (Syntetos & Boylan 2005):
  forecast = (z_t / q_t) × (1 - α/2)
```

- Purpose-built for intermittent demand: series with many zero weeks interspersed with
  occasional sales of 1–3 units — the typical pattern for luxury handbags/watches at
  Tier B/C stores
- Standard WMA and even Holt-Winters over-forecast intermittent series because they
  treat zeros as low demand rather than as demand-interval signals
- SBC correction removes the upward bias present in the original Croston (1972) method
- Does NOT produce a seasonal component — pair with a seasonal index multiplier if
  seasonality is also present (out of scope for initial implementation)
- Returns both `forecastedDemand` (expected units/week) and `demandProbability`
  (1/q_t, probability of a sale occurring in any given week) — useful for safety stock
- Hyperparameters: `αSize` (demand size smoothing, default 0.1),
  `αInterval` (interval smoothing, default 0.1); low alpha = slow adaptation,
  appropriate for luxury goods with long stable demand patterns
- New `ForecastMethod` enum value needed: `CROSTON_SBC`

---

##### Algorithm 4 — MAPE-Weighted Ensemble · *meta-algorithm*
*Complexity: O(sum of all sub-algorithms) + rolling evaluation · data required: ≥ 8 weeks*

```
For each candidate algorithm A ∈ {WMA, HOLT_WINTERS, CROSTON_SBC}:
  MAPE_A = mean(|actual_w - forecast_A_w| / max(actual_w, 1))
           over the last 4 completed weeks (rolling holdout)

  weight_A = 1 / (MAPE_A + ε)     ε = 0.01 to avoid division by zero

Final forecast = Σ(forecast_A × weight_A) / Σ(weight_A)

Confidence interval: pooled ±1.65σ across sub-algorithm error distributions
```

- Meta-algorithm: runs all three sub-algorithms and combines their outputs weighted by
  recent accuracy, automatically adapting to each SKU's current demand regime
- If a product transitions from regular to intermittent demand mid-season (common in
  luxury as items approach end-of-life), the ensemble shifts Croston weight up without
  any manual intervention
- MAPE baseline accumulates across nightly job runs; stored in `DemandForecast` rows
  via a new `mapeScore` field (nullable Decimal) — no new table needed
- Degenerate case: if a sub-algorithm has zero MAPE (perfect forecast for 4 weeks) it
  takes 100% weight; handled by the ε term
- Requires previous forecast rows to exist before the ensemble can evaluate accuracy —
  falls back to WMA on first run for a given variant × location pair
- New `ForecastMethod` enum value needed: `ENSEMBLE`

---

**Schema changes required before implementation:**
1. Add to `ForecastMethod` enum in `schema.prisma`:
   `HOLT_WINTERS`, `CROSTON_SBC`, `ENSEMBLE`
2. Add nullable `mapeScore Decimal?` column to `DemandForecast` model
   (stores the error metric used by the ensemble for the *previous* period's forecast)

**UI changes required:**
- `/forecasts` page: add algorithm selector dropdown (WMA / Holt-Winters / Croston /
  Ensemble / Auto) — stored per variant × location as a user preference, passed as
  `force` override to the dispatcher
- Forecast detail: show which algorithm was used and its recent MAPE score

---

## Database Entities

| Model | Purpose |
|-------|---------|
| User | Staff accounts with roles |
| Location | 1 warehouse + 20 stores |
| Supplier | Product suppliers |
| Product | SKU-level product definition |
| ProductVariant | Size/color variants |
| InventoryLevel | Current stock per variant per location |
| StockMovement | Immutable ledger of every stock change |
| TransferOrder | Stock movement between locations |
| PurchaseOrder | Orders from suppliers |
| DemandForecast | Weekly demand predictions |
| Alert | System notifications |
| CostRecord | Nightly carrying cost snapshots |
| ExchangeRate | Daily FX rates for multi-currency POs |
| CategoryCarryingRate | Annual carrying rate per product category |

**Key design rule:** `InventoryLevel` is never written directly. Every stock change goes through the `record_stock_movement()` PostgreSQL function which atomically writes a `StockMovement` row AND updates `InventoryLevel` in one transaction.

---

## Roles

| Role | Access |
|------|--------|
| ADMIN | Full access to everything |
| WAREHOUSE_MANAGER | Manage POs, TOs, stock at warehouse |
| STORE_MANAGER | View/request transfers for their store |
| ANALYST | Read-only access to all data and reports |

---

## How to Run

```bash
# 1. Start database (run this after every computer restart)
cd /home/localuser/Rolle
docker compose up -d

# 2. Start the app
npm run dev
# → opens at http://localhost:3000

# 3. Login
# Email:    admin@rolle.com
# Password: admin123
```

### Other useful commands
```bash
npm run db:studio      # Browse database at http://localhost:5555
npm run db:migrate     # Apply schema changes to the database
npm run db:seed        # Re-load demo data
npm run worker         # Start BullMQ background workers (separate terminal)
docker compose down    # Stop the database
docker compose ps      # Check if database is running
```

---

## File Structure (current)

```
Rolle/
├── app/
│   ├── (auth)/login/            ← Login page
│   ├── (dashboard)/
│   │   ├── layout.tsx           ← Sidebar + header shell (server component, reads session)
│   │   ├── dashboard/page.tsx   ← KPI home page
│   │   ├── inventory/page.tsx   ← Stock grid (all SKUs × 21 locations)
│   │   ├── products/page.tsx    ← Product list
│   │   ├── products/[id]/       ← Product detail + variant stock breakdown
│   │   ├── locations/page.tsx   ← 21 locations table
│   │   ├── alerts/page.tsx      ← Open alerts grouped by severity
│   │   ├── suppliers/page.tsx   ← Supplier list
│   │   ├── transfer-orders/     ← Full lifecycle (Phase 2)
│   │   ├── purchase-orders/     ← Full lifecycle (Phase 2)
│   │   ├── inventory/adjustments/  ← Manual adjustments
│   │   ├── inventory/count/     ← Physical count workflow
│   │   ├── inventory/sales-import/ ← CSV sales import
│   │   ├── forecasts/page.tsx   ← Demand forecast table + Run button
│   │   ├── allocation/page.tsx  ← Allocation engine UI
│   │   ├── reports/             ← Stub (Phase 4)
│   │   └── settings/            ← User management
│   ├── api/
│   │   ├── auth/                ← NextAuth endpoint
│   │   ├── allocation/          ← propose + create-transfers
│   │   ├── inventory/           ← sales-import, count-export, sales-template
│   │   ├── jobs/trigger/        ← Manual job trigger (admin)
│   │   └── webhooks/pos/        ← POS webhook
│   └── layout.tsx
├── components/
│   ├── layout/                  ← AppShell, Sidebar, Header, SessionProvider
│   └── ui/                      ← shadcn/ui components
├── lib/
│   ├── auth.ts                  ← NextAuth config
│   └── cache.ts                 ← Redis getCached<T> + invalidateCache
├── server/
│   ├── actions/                 ← Server Actions: inventory, products, PO, TO, users, suppliers
│   ├── db/index.ts              ← Prisma client singleton
│   ├── jobs/                    ← BullMQ: queues, workers, scheduler, redis
│   └── services/                ← forecasting, safety-stock, allocation
├── prisma/
│   ├── schema.prisma            ← Complete data model
│   ├── seed.ts                  ← Demo data
│   └── migrations/              ← SQL migrations
├── middleware.ts                ← Route protection
├── docker-compose.yml           ← PostgreSQL + Redis
└── .env                         ← Local environment variables
```
