# Kibali Stores — Business Management Platform

Mobile-first web app that replaces paper records for the Kibali Stores family businesses (frozen treats & more): sales, stock, supplier money, expenses, batch profits, and investor capital — one source of truth, plain English, novice-friendly.

**Repo:** git@github.com:brightexsolutions/kibali-stores.git
**Full approved plan:** `~/.claude/plans/1-want-to-create-elegant-tower.md` (2026-07-03)

> This file is the project's living state. It is kept current every session so work can resume after `/clear` with zero other context.

## Milestones

| # | Milestone | Status |
|---|-----------|--------|
| M0 | Scaffold & foundations (monorepo, UI base, Supabase clients, middleware, /login, /api/health, CLAUDE.md) | ✅ COMPLETE (2026-07-03) |
| M1 | Database (schema + GRANTs, RLS, views incl. FIFO batch view, seed) | 🔨 IN PROGRESS |
| M2 | Setup screens (/settings, /products, /suppliers list, /team account creation) | ⬜ |
| M3 | Record flows (/home, /sale/new, /expense/new, /delivery/new, /loss/new, /today, /distribute) | ⬜ |
| M4 | Stock, batches & supplier money (+ reorder alerts & order suggestions) | ⬜ |
| M5 | Owner dashboards (roll-ups, Recharts, Profit Banked, batch strip) | ⬜ |
| M6 | Investors, capital & profit distribution (+ /i/[token] links, /activity audit viewer) | ⬜ |
| M7 | Help area, polish, PWA, deploy (Vercel + cron-job.com + Brightex health dashboard) | ⬜ |

## Current status / next step

- ✅ M0 verified 2026-07-03: build clean, `/api/health` responds in Brightex shape, unauthenticated routes 307 → `/login`, `/login` renders. `apps/web/.env.local` currently holds PLACEHOLDER Supabase values.
- M1 in progress: `supabase/migrations/001_schema.sql`, `002_rls.sql`, `003_views.sql` and `scripts/seed.ts` all written (untested — no Supabase project yet). **Next:** run migrations 001→003 in the Supabase SQL editor, `npm run seed`, then the M1 verification pass (manager RLS isolation, finished-batch profit = KSh 780 on seed delivery 1, partial payment 5,000/7,600 on delivery 2).
- **Blocked on user:** create the Supabase project and put real `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` in `apps/web/.env.local`. Migrations can then be run in the Supabase SQL editor in order (001 → 002 → 003).
- Note: `@next/swc-darwin-arm64` is pinned as a devDependency (npm skipped optional deps in this environment; Next needs the native binary to build).

## Business rules (confirmed with Godwin — do not re-ask)

- **Roles:** `super_admin` (Godwin — creates ALL accounts, no self-signup/invitations, temp password + forced first-login change), `owner` (parents — see all, record anywhere, place supplier orders, distribute stock), `manager` (one location only, RLS-enforced).
- **Profit rule:** profit is **banked per supplier delivery batch when that batch fully sells out** (FIFO attribution of sales/losses per location+product). Per-sale profit shows immediately as "profit so far"; monthly charts count batches *finished* in the month. Batches are calendar-independent.
- **Units:** products have two selling levels — whole **box** (wholesale, e.g. bought 290–330, sold 340–360) and single **piece** (retail, 5/10/15 bob). One stock pool, tracked internally in pieces, displayed "43 boxes + 20 pieces". Supply cost varies per delivery (bulk discounts) — snapshots on line items, never rewrite history.
- **Central flow:** parents can receive deliveries to "Main store" (deliveries.location_id NULL) and distribute to shops (`stock_distributions`); main-store stock is always visible.
- **Supplier money:** payments are rows (`supplier_payments`), partial payments explicit everywhere: "Paid X of Y — still owed Z".
- **Expenses:** rent / salary / electricity / other. Spoilage is NOT an expense category — recorded once in `stock_losses`, folded into profit by views.
- **Investors:** capital accounts (`capital_entries`: investments + returned profits); invest in ALL businesses (business_id NULL) or one business. Distribution shares **proportional to capital** (scope rule: business capital + general capital pool). Allocations start `pending`, settled by dated **Disburse** / **Return to business** buttons; returns compound capital. Capital history timeline must show how each add-up changed subsequent shares. Investors without logins get tokenized read-only `/i/[token]` pages.
- **Audit:** append-only `audit_logs` written by every server mutation via `lib/audit.ts`; `/activity` viewer for super_admin/owner.
- **Reorder:** `v_reorder_status` → "Order soon" cards with suggested qty from last order size + sell-through speed.
- **Help:** `/help` + "?" on every screen — preset-question chat helper, static content, NO AI.
- **Greetings:** time-of-day greeting by name (EAT) on /home and /dashboard.
- **Crons:** all on **cron-job.com** (not Vercel crons). `/api/health` runs a real Supabase query (keep-alive) and gets registered on the Brightex website project-health dashboard.
- **UI standards:** plain English (no accounting jargon), buttons `rounded` (4px) NEVER rounded-lg, touch targets 56–72px on record flows, `inputMode="decimal"`, admin tables `max-h-[440px] overflow-y-auto` + sticky thead, KES via `@kibali/shared` `formatKES`.
- **FinTrack is reference-only** — never copy its code (it will be rebuilt).

## Architecture

- **Monorepo (npm workspaces):** `apps/web` (Next.js 15 App Router, TS, Tailwind v3, shadcn-style components, TanStack Query, RHF+Zod, Recharts, sonner) + `packages/shared` (`@kibali/shared`: money.ts, types.ts, validations/, help-content.ts later). More Kibali apps may be added later.
- **Supabase:** Postgres + RLS + Auth. Migrations in `supabase/migrations/` (001_schema, 002_rls, 003_views, 004_seed). **Every CREATE TABLE followed by explicit GRANT** (post-May-2026 Supabase rule); views `WITH (security_invoker = true)`; `audit_logs` INSERT/SELECT only.
- **RLS helpers:** `is_owner()` (true for super_admin+owner), `can_access_location(loc)`, `can_access_business(biz)` — SECURITY DEFINER STABLE.
- **All money math lives in SQL views** (`v_stock_levels`, `v_delivery_summary`, `v_delivery_progress` FIFO batch view, `v_supplier_balances`, `v_sale_summary`, `v_daily_location_summary`, `v_reorder_status`, `v_investor_summary`, `v_capital_history`) — app code only formats.
- **Mutations:** always server-side (route handlers/server actions) with zod validation + `logAction()` audit write. Service-role client (`lib/supabase/admin.ts`) is server-only.
- **Middleware:** session refresh + auth guard; public: `/login`, `/api/health`, `/i/*`.

## Conventions

- Commit **after each milestone** (verified build + working feature first), author Godwin Brown, **no Co-Authored-By trailer**.
- Update the milestone table above (✅ COMPLETE + date) when a milestone finishes; advance the next one; keep "Current status / next step" honest.
- Verification steps per milestone are in the approved plan — run them before marking complete.

## Commands

```bash
npm install          # root — installs all workspaces
npm run dev          # Next.js dev server (apps/web)
npm run build        # production build (apps/web)
npm run seed         # seed script (from M1)
curl localhost:3000/api/health
```
