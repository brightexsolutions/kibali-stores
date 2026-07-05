-- ============================================================================
-- 004 — Push notifications + offline record sync
-- Run in the Supabase SQL editor AFTER 001–003 (same as before).
-- ============================================================================

-- ---------- push subscriptions (one row per device that turned them on) ----
create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant select, insert, update, delete on public.push_subscriptions to service_role;

alter table public.push_subscriptions enable row level security;
create policy push_subscriptions_own on public.push_subscriptions
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- ---------- notification dedupe (one alert per event per day) --------------
-- Written only server-side with the service role; no client access needed.
create table public.notification_events (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null,
  entity_key  text not null,
  sent_on     date not null default current_date,
  created_at  timestamptz not null default now(),
  unique (kind, entity_key, sent_on)
);
grant select, insert on public.notification_events to service_role;
alter table public.notification_events enable row level security;
-- no policies: clients (authenticated) have no grants here at all

-- ---------- offline sync: idempotency keys ---------------------------------
-- A record submitted from a phone's offline outbox carries a client-generated
-- uuid; if the same record is replayed twice (connection dropped after the
-- server saved it), the second insert is recognized instead of duplicated.
alter table public.sales        add column client_ref uuid unique;
alter table public.expenses     add column client_ref uuid unique;
alter table public.stock_losses add column client_ref uuid unique;
