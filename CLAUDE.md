# Kibali Stores — Business Management Platform

Mobile-first web app that replaces paper records for the Kibali Stores family businesses (frozen treats & more): sales, stock, supplier money, expenses, batch profits, and investor capital — one source of truth, plain English, novice-friendly.

**Repo:** git@github.com:brightexsolutions/kibali-stores.git
**Full approved plan:** `~/.claude/plans/1-want-to-create-elegant-tower.md` (2026-07-03)

> This file is the project's living state. It is kept current every session so work can resume after `/clear` with zero other context.

## Milestones

| # | Milestone | Status |
|---|-----------|--------|
| M0 | Scaffold & foundations (monorepo, UI base, Supabase clients, middleware, /login, /api/health, CLAUDE.md) | ✅ COMPLETE (2026-07-03) |
| M1 | Database (schema + GRANTs, RLS, views incl. FIFO batch view, seed) | ✅ COMPLETE & VERIFIED LIVE (2026-07-03) |
| M2 | Setup screens (/settings, /products, /suppliers, /team account creation) | ✅ COMPLETE (2026-07-03) — DB live, screens not yet click-tested in browser |
| M3 | Record flows (/home, /sale/new, /expense/new, /delivery/new, /loss/new, /today, /distribute) + day-start brief | ✅ COMPLETE (2026-07-03) — DB live, screens not yet click-tested in browser |
| M4 | Stock, batches & supplier money (+ reorder alerts & order suggestions) | ✅ COMPLETE (2026-07-03) — data verified live via SQL, screens not yet click-tested |
| M5 | Owner dashboards (roll-ups, Recharts, Profit Banked, batch strip) | ✅ COMPLETE (2026-07-03) — data verified live via SQL, screens not yet click-tested |
| M6 | Investors, capital & profit distribution (+ /i/[token] links, /activity) | ✅ COMPLETE (2026-07-03) — data verified live via SQL, screens not yet click-tested |
| M7 | Help, polish, PWA, favicon | ✅ CODE COMPLETE (2026-07-03) — deploy steps below |

## Current status / next step

**Database is LIVE and verified.** Godwin ran migrations 001→003 in the Supabase SQL editor on 2026-07-03. Seed ran successfully (`npm run seed`). Verified directly against the live DB (SQL queries, not yet through the browser UI):

- ✅ Delivery 1 (Tala, ice pops): `v_delivery_progress` shows `status=finished`, `realized_profit=780` — exact hand-check match.
- ✅ Delivery 2 (central lollies): `v_delivery_summary` shows `payment_status=partially_paid`, `paid=5000`, `owed=2600` of `total=7600`. Stock reconciles: Main store 160 pieces (4 boxes), Tala 160 pieces (4 boxes), Kangundo 220 pieces (5 boxes + 20 loose) — sums to 540 = total_pieces(800) − consumed(260). Note: `realized_profit` on this delivery reads **-4,500 while still selling** — this is correct, not a bug: the formula charges the *whole* batch cost against only the revenue collected *so far*, so it's negative until enough of the batch sells to cover cost, then climbs positive and gets banked at "Finished". Worth knowing so it doesn't look alarming on the dashboard mid-batch.
- ✅ `v_investor_summary`: Mama 48%, Baba 32%, Godwin 20% (capital-proportional, sums to 100%).
- ✅ RLS: manager.a (Tala) sees only their own location's sales (7 rows, 1 location_id), zero rows from `investors`/`audit_logs`, exactly their own `members` row. Write to Kangundo blocked by RLS policy; write to their own shop (Tala) succeeds.

**Not yet done:** clicking through the actual pages in a browser (dev server / deployed) — verification so far is SQL-level via the service-role and anon clients, not through the Next.js UI. **Next steps:**
1. Click-test the flows in a browser: log in as each seeded user, run through sale/expense/delivery/loss/distribute, dashboards, investors, `/i/[token]`, `/help`.
2. **Launch (M7 remainder):** Vercel deploy (root dir `apps/web`), env vars in Vercel, cron-job.com job pinging `https://<domain>/api/health` every 1–3 days (keeps Supabase awake), register the endpoint on the Brightex website project-health dashboard, clear seed data, create real accounts in /team, enter real products with the parents.

**Seed test logins** (password `KibaliTest!2026`): godwin@kibali.test (super admin), parent@kibali.test (owner), manager.a@kibali.test (Tala), manager.b@kibali.test (Kangundo).

## Business rules (confirmed with Godwin — do not re-ask)

- **Roles:** `super_admin` (Godwin — creates ALL accounts, no self-signup, temp password shown once + forced first-login change), `owner` (parents — see all, record anywhere, place supplier orders, distribute stock from Main store), `manager` (one location only, RLS-enforced; same-day edit/remove of own records only).
- **Profit rule:** profit is **banked per supplier delivery batch when that batch fully sells out** (FIFO attribution per location+product, two-stage through Main-store distributions). Per-sale profit shows immediately as "profit so far". Batches are calendar-independent; monthly views count batches finished in the month.
- **Units:** two selling levels per product — whole **box** wholesale, single **piece** retail — one stock pool tracked in pieces, shown as "43 boxes + 20 pieces". Supply cost varies per delivery (bulk discounts) — snapshots on line items; product "usual" prices are prefills only.
- **Central flow:** deliveries with `location_id NULL` = Main store; owners distribute via `stock_distributions`; main-store stock always visible.
- **Supplier money:** payments are rows; partial payments explicit everywhere ("Paid X of Y — still owed Z").
- **Expenses:** rent / salary / electricity / other. Spoilage is NOT an expense — `stock_losses` records it once (stock down + folded into profit).
- **Investors:** capital accounts; invest in ALL businesses (`business_id NULL`) or one. Distribution shares proportional to capital; scope rule = business capital + general capital pool. Allocations start `pending` → dated **Disburse / Return to business** buttons; returns create `reinvested_profit` capital entries (compounding). Capital history shows how each add-up changed the split. `/i/[token]` public read-only investor pages; links regenerable.
- **Audit:** append-only `audit_logs` written by every server action via `lib/audit.ts`; `/activity` viewer (owners).
- **Day-start brief:** every role's first screen answers: yesterday's sales, stock available now, and any "Order soon" notices with suggested quantities (from last order size + sell-through speed).
- **Help:** `/help` — chat-style preset Q&A (NO AI), content central in `packages/shared/help-content.ts`, "?" button in the header on every screen.
- **Crons:** all on **cron-job.com** (never Vercel crons). `/api/health` runs a real Supabase query (keep-alive) — register on Brightex health dashboard.
- **UI standards:** plain English, buttons `rounded` (4px) NEVER larger, touch targets 56–72px, `inputMode` on numeric fields, admin tables `max-h-[440px]` + sticky thead, KES via `formatKES`.
- **FinTrack is reference-only** — never copy its code.

## Architecture & conventions

- **Monorepo (npm workspaces):** `apps/web` (Next.js 15 App Router, TS, Tailwind v3, TanStack Query, RHF+Zod, Recharts, sonner) + `packages/shared` (`@kibali/shared`).
- **Everything shared lives centrally:**
  - `packages/shared/types.ts` — ALL interfaces; repeating fields come from base interfaces `Entity` / `Timestamps` / `SoftDeletable` / `BaseRow` / `CatalogRow` / `OwnedRecord` — new interfaces must extend these, never redeclare `id`/`created_at`/`deleted_at`.
  - `packages/shared/validations/` — every zod schema (server actions parse with these).
  - `packages/shared/help-content.ts` — all help topics.
  - `apps/web/components/ui/` — base UI (button, card, input, label, select, textarea, badge, modal, admin-table). `apps/web/components/` — shared feature components (app-header, day-brief, stat-card, batch-strip, location-picker, sign-out-button). `apps/web/components/charts/` — shared Recharts components (monthly-bars). **Never define one-off buttons/tables/charts inside pages — add/extend here.**
- **Supabase:** migrations in `supabase/migrations/` (001 schema — GRANT after EVERY create table; 002 RLS — `is_owner()`/`is_super_admin()`/`can_access_location()`/`can_access_business()` SECURITY DEFINER helpers; 003 views — all money math, `security_invoker = true`). `audit_logs` = INSERT/SELECT only.
- **All money math in SQL views** (`v_stock_levels`, `v_delivery_summary`, `v_delivery_progress`, `v_supplier_balances`, `v_sale_summary`, `v_daily_location_summary`, `v_reorder_status`, `v_investor_summary`, `v_capital_history`); app code only formats + rolls up via `lib/summaries.ts`.
- **Mutations:** server actions in `apps/web/app/actions/*` — zod parse → RLS-scoped write → `logAction()` audit → `revalidatePath`. Service-role client (`lib/supabase/admin.ts`) is server-only (accounts, investor link pages).
- **Auth:** middleware session guard (public: `/login`, `/api/health`, `/i/*`); `lib/auth.ts` guards (`requireMember`/`requireOwner`/`requireSuperAdmin`), forced password change via `profiles.must_change_password`.
- Commit **after each milestone** (build clean + feature verified first), author Godwin Brown, **no Co-Authored-By trailer**. Update the milestone table + this status section every session.
- Note: `@next/swc-darwin-arm64` pinned as devDependency (npm skipped optional deps in this environment).

## Commands

```bash
npm install          # root — installs all workspaces
npm run dev          # Next.js dev server (apps/web)
npm run build        # production build (apps/web)
npm run seed         # seed demo data (AFTER migrations are run)
curl localhost:3000/api/health
```
