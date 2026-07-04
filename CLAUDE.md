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
| M7 | Help, polish, PWA, favicon | ✅ COMPLETE (2026-07-03) — deploy steps below |
| M8 | Design overhaul: bottom nav, gradient cards, wholesale bargain pricing, loading states | ✅ COMPLETE (2026-07-04) |
| M9 | Card-based shop picker, dark mode, categorized help page, Business Statement (month filter + P&L) | ✅ COMPLETE (2026-07-04) |

## Current status / next step

**Database is LIVE, verified, and browser-tested.** Godwin ran migrations 001→003 in the Supabase SQL editor on 2026-07-03. Seed ran successfully. Verified directly against the live DB AND via full Playwright click-through (login → forced password change → sale/expense/delivery/loss → dashboards → investors → `/i/[token]` → team → activity):

- ✅ Delivery 1 (Tala, ice pops): `v_delivery_progress` shows `status=finished`, `realized_profit=780` — exact hand-check match.
- ✅ Delivery 2 (central lollies): `payment_status=partially_paid`, paid 5,000 of 7,600 owed 2,600. Stock reconciles across Main store/Tala/Kangundo. Note: `realized_profit` on an in-progress batch can read **negative** — correct, not a bug: the formula charges the whole batch cost against only revenue collected so far; it climbs positive and gets banked at "Finished".
- ✅ `v_investor_summary`: Mama 48%, Baba 32%, Godwin 20% (capital-proportional, sums to 100%).
- ✅ RLS: manager sees only their own location's records, zero investor/audit rows, blocked from writing cross-shop.
- ✅ Browser click-through: 27/29 automated checks passed end-to-end (2026-07-03 session); manual owner confirmation of dashboard/supplier navigation still pending (see open item below).

**Current logins** (all reset to a known state, no forced change pending): password **`KibaliTest!2026`** for `godwin@kibali.test` (super admin), `parent@kibali.test` (owner), `manager.a@kibali.test` (Tala), `manager.b@kibali.test` (Kangundo). Re-seeding or resetting these via the admin client will re-enable forced password change (`must_change_password`) — expected.

**Open item (not yet root-caused):** in automated (headless Playwright) testing, clicking a business card on `/dashboard` or a supplier row on `/suppliers` sometimes doesn't navigate client-side (RSC fetch returns 200 but URL doesn't update; direct navigation to the same URL always works fine). Ruled out: middleware (reproduces identically with it removed). The browser logs `ERR_NETWORK_IO_SUSPENDED`, a low-level Chromium signal associated with headless/automation environments — never reproduced on static routes (sale/expense/investors all navigate reliably). Likely a headless-only artifact, not a real-user bug, but **not confirmed in a real browser yet** — do a 10-second manual check (tap a business card, tap a supplier row) before fully trusting this in production.

**Next steps:**
1. Manual real-browser confirmation of the item above.
2. **Launch (M7 remainder):** Vercel deploy (root dir `apps/web`), env vars in Vercel, cron-job.com job pinging `https://<domain>/api/health` every 1–3 days (keeps Supabase awake), register the endpoint on the Brightex website project-health dashboard, clear seed data, create real accounts in /team, enter real products with the parents.

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
- **Wholesale bargaining:** box sales can be sold below list price when a customer bargains or buys many boxes — the sale confirm step has "Quick price" chips (Full price / -5 / -10 / -20) per line plus a free-text override; a "Bargained" badge shows the discount against the full price. No schema change — it's just the existing editable `unit_price` per `sale_item`, made explicit and fast.
- **Navigation model (2026-07-04):** bottom nav is **context-aware**, not purely role-based. Owners get the manager-style nav (Home/Stock/Sale/Today/More) whenever the current route is a shop-context route (`/home`, `/stock`, `/today`, `/sale`, `/expense`, `/delivery`, `/loss`) — because owners record sales/expenses/stock at any shop just like managers. Otherwise owners see Dashboard/Suppliers/Sale/Investors/More. Managers always see the shop-context nav. Logic lives in `components/bottom-nav.tsx` (`SHOP_CONTEXT_PREFIXES`).
- **Shop picker (2026-07-04):** `components/location-picker.tsx` renders shops as a tappable card grid (not a dropdown) — colored icon tiles, active one highlighted with a ring + checkmark. Used on `/home` and `/stock` for owners choosing which shop to view.
- **Dark mode (2026-07-04):** `next-themes` (`attribute="class"`, `defaultTheme="system"`), toggle button in `components/theme-toggle.tsx` in the header. Dark CSS variables in `globals.css` under `.dark`. **Any new hardcoded Tailwind color (`bg-amber-50`, `border-emerald-300`, etc.) needs a `dark:` variant** — prefer the semantic tokens (`bg-card`, `text-muted-foreground`, `border-border`) which already adapt automatically. `formatKES` normalizes `-0` so category totals of exactly zero never render as "KSh -0".
- **Business Statement (2026-07-04):** `/reports` (owner/super_admin) — pick a business scope (All / one business) and a month via URL params (`?business=<id>&month=YYYY-MM`), see a P&L-style breakdown (Sales, COGS, Gross profit, expense categories, Total expenses, Spoiled/lost stock, Net profit) plus a per-shop table. Uses `lib/summaries.ts` `monthRange`/`adjacentMonth` helpers; all server-rendered with Link-based navigation, no client JS needed for the selectors. Linked from `/more` and both dashboard levels ("View statement").
- **Help page (2026-07-04):** topics now have a `category` (`packages/shared/help-content.ts` `HelpCategory`) and the `/help` UI (`help-chat.tsx`) shows a grid of gradient category cards first, drilling into that category's questions — replaces the old flat list. Header help icon is `MessageCircleQuestion` (was `CircleHelp`) since the page is a chat-style assistant.
- **FinTrack is reference-only** — never copy its code.

## Architecture & conventions

- **Monorepo (npm workspaces):** `apps/web` (Next.js 15 App Router, TS, Tailwind v3, TanStack Query, RHF+Zod, Recharts, sonner) + `packages/shared` (`@kibali/shared`).
- **Everything shared lives centrally:**
  - `packages/shared/types.ts` — ALL interfaces; repeating fields come from base interfaces `Entity` / `Timestamps` / `SoftDeletable` / `BaseRow` / `CatalogRow` / `OwnedRecord` — new interfaces must extend these, never redeclare `id`/`created_at`/`deleted_at`.
  - `packages/shared/validations/` — every zod schema (server actions parse with these).
  - `packages/shared/help-content.ts` — all help topics.
  - `apps/web/components/ui/` — base UI (button — has a `loading` prop that auto-shows a spinner + disables, use it for every async action; card, input, label, select, textarea, badge, modal, admin-table). `apps/web/components/` — shared feature components (app-header, bottom-nav, day-brief, stat-card — gradient `tone` variants: primary/warn/info/danger, batch-strip, location-picker, sign-out-button). `apps/web/components/charts/` — shared Recharts components (monthly-bars). **Never define one-off buttons/tables/charts inside pages — add/extend here.**
- **Supabase:** migrations in `supabase/migrations/` (001 schema — GRANT after EVERY create table; 002 RLS — `is_owner()`/`is_super_admin()`/`can_access_location()`/`can_access_business()` SECURITY DEFINER helpers; 003 views — all money math, `security_invoker = true`). `audit_logs` = INSERT/SELECT only.
- **All money math in SQL views** (`v_stock_levels`, `v_delivery_summary`, `v_delivery_progress`, `v_supplier_balances`, `v_sale_summary`, `v_daily_location_summary`, `v_reorder_status`, `v_investor_summary`, `v_capital_history`); app code only formats + rolls up via `lib/summaries.ts`.
- **Mutations:** server actions in `apps/web/app/actions/*` — zod parse → RLS-scoped write → `logAction()` audit → `revalidatePath`. Service-role client (`lib/supabase/admin.ts`) is server-only (accounts, investor link pages).
- **Auth:** middleware session guard (public: `/login`, `/api/health`, `/i/*`); `lib/auth.ts` guards (`requireMember`/`requireOwner`/`requireSuperAdmin`), forced password change via `profiles.must_change_password`.
- Commit **after each milestone** (build clean + feature verified first), author Godwin Brown, **no Co-Authored-By trailer**. Update the milestone table + this status section every session.
- Note: `@next/swc-darwin-arm64` pinned as devDependency (npm skipped optional deps in this environment).
- **Gotcha:** running `npm run build` (production) and `next dev` against the same `apps/web/.next` directory without clearing it in between can leave a stale/mismatched build — symptom: `/_next/static/chunks/main-app.js` 404s and the whole app silently loses client-side interactivity (forms fall back to native GET submission, no JS errors thrown). Fix: `rm -rf apps/web/.next` before switching between build and dev.
- **Gotcha:** `pkill -f "next dev"` matches every dev server matching that pattern on the machine, including ones the user started themselves to review your work — this has caused an accidental interruption before. Prefer killing a specific PID/port (`lsof -iTCP -sTCP:LISTEN -P | grep <port>`) over a broad pattern kill.

## Commands

```bash
npm install          # root — installs all workspaces
npm run dev          # Next.js dev server (apps/web)
npm run build        # production build (apps/web)
npm run seed         # seed demo data (AFTER migrations are run)
curl localhost:3000/api/health
```
