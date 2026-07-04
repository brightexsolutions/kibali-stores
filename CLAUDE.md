# Kibali Stores — Business Management Platform

Mobile-first web app that replaces paper records for the Kibali Stores family businesses (frozen treats & more): sales, stock, supplier money, expenses, batch profits, and investor capital — one source of truth, plain English, novice-friendly.

**Repo:** git@github.com:brightexsolutions/kibali-stores.git
**Full approved plan:** `~/.claude/plans/1-want-to-create-elegant-tower.md` (2026-07-03)

> This file is the project's living state. It is kept current every session so work can resume after `/clear` with zero other context.

## 🔭 Future roadmap (recorded 2026-07-04 — NOT STARTED, do not build without explicit go-ahead)

Godwin is considering turning this from a single-family app into a **leasable multi-tenant SaaS product** for other businesses, alongside Kibali Stores' own use. Recorded now, deferred deliberately — nothing below should be started without him explicitly saying so:

- **Landing/marketing page** — a public showcase site for the product (separate from the authenticated app), to present it to prospective business customers.
- **Multi-tenancy** — other (non-family) businesses would lease the platform. When a business registers, **the app should take on their business name** (white-label per tenant) rather than showing "Kibali Stores." Implies a generic/neutral product name is needed for the underlying platform — not yet decided.
- **Subscription billing** — monthly, per-business subscription fee.
- **Onboarding flow (deliberately NOT self-service):** a prospective customer requests a demo → pays the subscription fee → **only then** does their business get set up (implies admin-assisted onboarding, at least initially — not an open signup form).
- **Payments** — via Godwin's own M-Pesa Paybill or Till number, not a card processor.

**Open questions to resolve before building (not urgent — surface these when Godwin wants to start):**
- Multi-tenancy architecture: shared database with a `tenant_id`/`organization_id` column + RLS scoping (fits the existing schema shape well since it's already RLS-heavy), vs. fully separate Supabase projects per tenant (simpler isolation, more ops overhead per customer).
- What "the app takes the business name" means concretely — custom subdomain per tenant (`acme.kibali.app`)? Just a configurable display name/logo inside a shared UI? Fully separate deployment?
- Product name for the generic/white-label platform (Kibali Stores stays the name for Godwin's family instance either way).
- Whether Kibali Stores (family) becomes tenant #1 on the new multi-tenant platform, or stays a separate, simpler deployment forever while a new platform is built alongside it.
- Demo request → payment → setup: is "setup" manual (Godwin configures it) or an admin-triggered automated provisioning flow?

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
| M10 | Data freshness: /dashboard revalidation on every mutation, 60s auto-refresh on all screens | ✅ COMPLETE (2026-07-04) |
| M11 | Readability: 18px base font size, bigger StatCard/DayBrief/Badge/Today's-Records text | ✅ COMPLETE (2026-07-04) |
| M12 | Login redesign, icon+text header nav, supplier last-supply date, record times, nav/color polish | ✅ COMPLETE (2026-07-04) |
| M13 | Public landing page ("Kibali Enterprise"), OG image/metadata, owner-only historical backdating | ✅ COMPLETE (2026-07-04) |
| M14 | Soft-delete for businesses & locations (settings page) | ✅ COMPLETE (2026-07-04) |
| M15 | Inline "add new supplier" from the Stock Arrived flow (owners) | ✅ COMPLETE (2026-07-04) |
| M16 | Stock Arrived / Send Stock promoted to top of /dashboard | ✅ COMPLETE (2026-07-04) |
| M17 | "All shops" combined stock view (was one-shop-at-a-time only) | ✅ COMPLETE (2026-07-04) |

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
- **Data freshness (2026-07-04, confirmed with Godwin: 60s auto-refresh, not real-time push):** `components/auto-refresh.tsx` — a client component (no props) that calls `router.refresh()` every 60s and immediately on tab/app refocus (`visibilitychange`). Mounted once in `(app)/layout.tsx` so every authenticated screen gets it for free, and separately in `app/i/[token]/page.tsx` (outside the layout group) for investors. `router.refresh()` re-runs the current route's server queries without a hard reload or losing in-progress client form state. All mutations in `app/actions/records.ts` also revalidate `/dashboard` in addition to `/home`/`/today`, so the owner's dashboard never lags behind a manager's actions elsewhere.
- **Login page (2026-07-04):** redesigned with a full-bleed emerald/teal gradient background, icon badge, and icon-decorated inputs — no longer a plain gray card. `app/login/page.tsx`.
- **Header nav (2026-07-04):** Help and Log out are icon+text everywhere (including phones) — `components/app-header.tsx` and `components/sign-out-button.tsx`. To make room at 390px width, the brand shows as "Kibali" below `sm:` and "Kibali Stores" at `sm:` and up.
- **Color hierarchy rule:** reserve the emerald/primary gradient for actionable buttons only. Informational "Total" summary cards (sale confirm, `/reports`) use a neutral `from-slate-700 to-slate-900` gradient instead, so a total displayed just above a green "Save" button doesn't visually blend with it. Apply this to any new hero/total card placed near a primary action button.
- **AdminTable (`components/ui/admin-table.tsx`):** now `overflow-auto` (was `overflow-y-auto` only) with `min-w-max` on the table, so tables with more columns than fit a phone's width scroll horizontally instead of clipping content with no way to reach it.
- **Suppliers list "Last supply" column:** `/suppliers/page.tsx` fetches each supplier's most recent `deliveries.delivery_date` (deliveries pre-sorted newest-first, first match per supplier wins) and passes it to `suppliers-manager.tsx` as a plain `Record<string, string>` map — no view/migration change.
- **Today's Records shows time-of-day per entry:** `v_sale_summary`/`v_delivery_summary` don't expose `created_at`, so `/today/page.tsx` runs two extra lightweight queries against the base `sales`/`deliveries` tables (id + created_at only) and merges by id; expenses/stock_losses already query their base tables directly so `created_at` was just added to those selects. Rendered via a shared `recordedAt()` formatter in `today-list.tsx`.
- **Verification note:** running a second `next dev`/`next build` against the same `apps/web/.next` as the user's live server corrupts it (see the hard rule above) even on a different port, because both processes write to the same on-disk webpack cache. For any future UI verification while the user's server might be running, use an isolated `git worktree` (symlink `node_modules`, copy `.env.local`) with its own directory and `.next`, then remove the worktree when done — never run a second dev/build instance against the primary checkout.
- **Public landing page (2026-07-04):** `/` is now a public route (added to `PUBLIC_PATHS` in `middleware.ts`). `app/page.tsx` checks the raw Supabase session first — no session → renders `components/landing-page.tsx` (public marketing content, brand name **"Kibali Enterprise"**); has a session → same role-routing as before (`/home`, `/dashboard`, `/welcome`, `/account/password`). Login page and everything past authentication keeps the **"Kibali Stores"** brand — this is a deliberate, lightweight preview of the eventual white-label split described in the Future roadmap above, without any real multi-tenancy.
- **OG image & metadata:** `app/opengraph-image.tsx` uses `next/og` (`ImageResponse`, edge runtime) to generate a branded 1200×630 share-preview image on the fly — no static asset. Root layout metadata gained `metadataBase` (reads `NEXT_PUBLIC_SITE_URL`, falls back to localhost), `openGraph`, and `twitter` fields; `app/page.tsx` has its own route-specific `title`/`description` for the landing page. **Important:** the middleware matcher's negative-lookahead had to be extended to exclude `opengraph-image`/`twitter-image` — without that, middleware redirected those metadata routes to `/login` (no session = crawlers can't render them), silently breaking every link preview. Any future metadata-route file needs the same matcher exclusion.
- **Owner-only historical backdating:** `components/backdate-field.tsx` — collapsed-by-default "This happened on a different day?" control, capped at today, rendered only when the calling form passes `allowBackdate`/`isOwner` truthy (managers never see it, keeping their flow untouched). Wired into `/sale/new`, `/expense/new`, `/delivery/new`, `/loss/new`. No RLS change was needed — insert policies were never date-restricted, only same-day edit/delete is. Because every profit/stock calculation (FIFO batch attribution, daily summaries) is driven by the record's date rather than insertion order, backfilling old paper records with their real dates makes everything reconcile correctly on its own.
- **Business/location soft-delete (2026-07-04):** `deleteBusiness`/`deleteLocation` in `app/actions/catalog.ts` — owner-only, sets `deleted_at` (never a real DELETE). Deleting a business cascades to soft-delete all its own locations too, so nothing "orphaned" remains visible in `/settings` (both queries already filter `.is("deleted_at", null)`, so removed rows disappear from active lists automatically — no other query changes needed). Historical sales/expenses/deliveries under a removed shop are untouched and still count correctly in `/reports` and dashboards. **Known gap, not yet handled:** a manager still assigned to a soft-deleted location isn't automatically deactivated — their `members` row and RLS access remain; deactivate them separately via `/team` if a shop closes for good.
- **Inline "add new supplier" (2026-07-04):** the delivery-form supplier dropdown was owner-only-viewable-list, no way to add a brand-new supplier without leaving the page first — fixed. `saveSupplier` (`app/actions/catalog.ts`) now returns `ActionResult<{ id: string }>` (was bare `ActionResult`) so the caller knows the new row's id. `delivery-form.tsx` keeps a `localSuppliers` client-state copy seeded from the server prop; picking "+ New supplier…" opens a modal, and on save the new supplier is pushed into `localSuppliers` and auto-selected — no `router.refresh()`/page reload, so any delivery lines already typed are preserved. Managers still can't create suppliers (matches the owner-only `suppliers_write` RLS policy) — they see a note to ask an owner instead. The business picker in that modal is derived from the delivery page's already-fetched `locations` (deduped by `business_id`), no extra query.
- **Dashboard quick actions (2026-07-04):** `/dashboard` previously had zero record-entry shortcuts of its own — Stock Arrived lived only in `/more` (2 taps) or on a specific location's page. Since receiving supplies and distributing them to shops is the parents' central, daily operation, added "Stock Arrived" and "Send Stock" as the very first thing on `/dashboard`, above even the stat cards.
- **"All shops" combined stock view (2026-07-04):** `/stock` previously forced owners to pick exactly one shop or Main store at a time — no way to see everything at once. `LocationPicker` gained an `allowAll` prop rendering an "All shops" card that sets `?location=all`; `/stock/page.tsx` handles that value as its own branch (checked before the normal `resolveLocation` flow) — fetches all `v_stock_levels` rows unfiltered, groups them by `location_id` client-side (via `listAccessibleLocations`), and renders one section per shop plus a Main store section, each using the same `StockRow` card. Owner/super_admin only, same as the rest of the location picker.
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
- **Hard rule: never `rm -rf apps/web/.next` while the user's own dev server might be running against it** — even without touching their process, clearing `.next` out from under a live `next dev` breaks it the same way as the build/dev conflict above (`main-app.js` 404s, no JS errors, forms silently fall back to native submission). This has broken Godwin's live session twice. If a clean production build check is needed, either ask first, or build/verify against a separate checkout, not the directory the user's server is pointed at. Check `lsof -iTCP -sTCP:LISTEN -P | grep 3000` before touching `.next`.

## Commands

```bash
npm install          # root — installs all workspaces
npm run dev          # Next.js dev server (apps/web)
npm run build        # production build (apps/web)
npm run seed         # seed demo data (AFTER migrations are run)
curl localhost:3000/api/health
```
