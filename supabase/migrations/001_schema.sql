-- ============================================================
-- Kibali Stores — 001_schema.sql
-- Tables, enums, triggers, grants, indexes.
-- Rule: every CREATE TABLE is immediately followed by its GRANT
-- (Supabase projects created after May 30 2026 need explicit grants).
-- ============================================================

-- ---------- Enums ----------
create type member_role as enum ('super_admin', 'owner', 'manager');
create type sale_type as enum ('wholesale', 'retail');
create type unit_level as enum ('box', 'piece');
create type expense_category as enum ('rent', 'salary', 'electricity', 'other');
create type capital_entry_type as enum ('investment', 'reinvested_profit');
create type allocation_status as enum ('pending', 'disbursed', 'returned_to_business');
create type distribution_status as enum ('draft', 'confirmed');

-- ---------- Shared trigger: keep updated_at fresh ----------
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- Identity & access
-- ============================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  phone text,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at_column();

-- Auto-create a profile whenever an auth user is created
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'phone'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
grant select, insert, update, delete on public.businesses to authenticated;

create trigger businesses_updated_at
  before update on public.businesses
  for each row execute function public.update_updated_at_column();

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id),
  name text not null,
  monthly_rent numeric(12,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
grant select, insert, update, delete on public.locations to authenticated;

create index locations_business_id_idx on public.locations (business_id);

create trigger locations_updated_at
  before update on public.locations
  for each row execute function public.update_updated_at_column();

create table public.members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  role member_role not null default 'manager',
  -- NULL for super_admin/owner (sees all); required for managers (their shop)
  location_id uuid references public.locations (id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (user_id, location_id),
  constraint manager_needs_location
    check (role <> 'manager' or location_id is not null)
);
grant select, insert, update, delete on public.members to authenticated;

create index members_user_id_idx on public.members (user_id);
create index members_location_id_idx on public.members (location_id);

create trigger members_updated_at
  before update on public.members
  for each row execute function public.update_updated_at_column();

-- ============================================================
-- Catalog
-- ============================================================

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id),
  name text not null,
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
grant select, insert, update, delete on public.suppliers to authenticated;

create index suppliers_business_id_idx on public.suppliers (business_id);

create trigger suppliers_updated_at
  before update on public.suppliers
  for each row execute function public.update_updated_at_column();

create table public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id),
  name text not null,
  -- two-level unit model: sold as whole boxes (wholesale) or single pieces (retail)
  unit_name text not null default 'box',
  piece_name text not null default 'piece',
  pieces_per_unit integer not null default 1 check (pieces_per_unit > 0),
  cost_price numeric(12,2) not null default 0,            -- usual cost per box (prefill only)
  wholesale_price numeric(12,2) not null default 0,       -- per box
  retail_price_per_piece numeric(12,2) not null default 0,
  low_stock_threshold integer not null default 10,        -- in boxes
  reorder_buffer_days integer not null default 3,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
grant select, insert, update, delete on public.products to authenticated;

create index products_business_id_idx on public.products (business_id);

create trigger products_updated_at
  before update on public.products
  for each row execute function public.update_updated_at_column();

-- ============================================================
-- Stock in
-- ============================================================

create table public.deliveries (
  id uuid primary key default gen_random_uuid(),
  -- NULL = received centrally ("Main store") by the parents, distributed later
  location_id uuid references public.locations (id),
  supplier_id uuid not null references public.suppliers (id),
  delivery_date date not null default current_date,
  total_cost numeric(12,2) not null check (total_cost >= 0),
  notes text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
grant select, insert, update, delete on public.deliveries to authenticated;

create index deliveries_location_date_idx on public.deliveries (location_id, delivery_date);
create index deliveries_supplier_id_idx on public.deliveries (supplier_id);

create trigger deliveries_updated_at
  before update on public.deliveries
  for each row execute function public.update_updated_at_column();

create table public.delivery_items (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.deliveries (id) on delete cascade,
  product_id uuid not null references public.products (id),
  quantity integer not null check (quantity > 0),          -- in boxes
  unit_cost numeric(12,2) not null check (unit_cost >= 0), -- actual price paid THIS delivery
  unit_wholesale_price numeric(12,2) not null check (unit_wholesale_price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.delivery_items to authenticated;

create index delivery_items_delivery_id_idx on public.delivery_items (delivery_id);
create index delivery_items_product_id_idx on public.delivery_items (product_id);

create trigger delivery_items_updated_at
  before update on public.delivery_items
  for each row execute function public.update_updated_at_column();

-- Parents send stock from the Main store to shops
create table public.stock_distributions (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid references public.deliveries (id),
  location_id uuid not null references public.locations (id),
  product_id uuid not null references public.products (id),
  quantity integer not null check (quantity > 0),          -- in boxes
  distribution_date date not null default current_date,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
grant select, insert, update, delete on public.stock_distributions to authenticated;

create index stock_distributions_location_date_idx
  on public.stock_distributions (location_id, distribution_date);
create index stock_distributions_product_id_idx on public.stock_distributions (product_id);

create trigger stock_distributions_updated_at
  before update on public.stock_distributions
  for each row execute function public.update_updated_at_column();

create table public.supplier_payments (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers (id),
  delivery_id uuid references public.deliveries (id),
  amount numeric(12,2) not null check (amount > 0),
  paid_on date not null default current_date,
  method text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
grant select, insert, update, delete on public.supplier_payments to authenticated;

create index supplier_payments_supplier_id_idx on public.supplier_payments (supplier_id);
create index supplier_payments_delivery_id_idx on public.supplier_payments (delivery_id);

create trigger supplier_payments_updated_at
  before update on public.supplier_payments
  for each row execute function public.update_updated_at_column();

-- ============================================================
-- Stock out
-- ============================================================

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations (id),
  sale_date date not null default current_date,
  sale_type sale_type not null default 'wholesale',
  customer_name text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
grant select, insert, update, delete on public.sales to authenticated;

create index sales_location_date_idx on public.sales (location_id, sale_date);

create trigger sales_updated_at
  before update on public.sales
  for each row execute function public.update_updated_at_column();

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete cascade,
  product_id uuid not null references public.products (id),
  quantity integer not null check (quantity > 0),
  unit_level unit_level not null default 'box',            -- box (wholesale) or piece (retail)
  unit_price numeric(12,2) not null check (unit_price >= 0), -- charged at that level
  unit_cost numeric(12,2) not null check (unit_cost >= 0),   -- cost snapshot at that level
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.sale_items to authenticated;

create index sale_items_sale_id_idx on public.sale_items (sale_id);
create index sale_items_product_id_idx on public.sale_items (product_id);

create trigger sale_items_updated_at
  before update on public.sale_items
  for each row execute function public.update_updated_at_column();

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations (id),
  category expense_category not null,
  amount numeric(12,2) not null check (amount > 0),
  expense_date date not null default current_date,
  description text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
grant select, insert, update, delete on public.expenses to authenticated;

create index expenses_location_date_idx on public.expenses (location_id, expense_date);

create trigger expenses_updated_at
  before update on public.expenses
  for each row execute function public.update_updated_at_column();

create table public.stock_losses (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations (id),
  product_id uuid not null references public.products (id),
  quantity integer not null check (quantity > 0),
  unit_level unit_level not null default 'piece',
  unit_cost numeric(12,2) not null check (unit_cost >= 0), -- cost snapshot at that level
  reason text not null default 'other',                    -- "melted", "expired", "broken"...
  loss_date date not null default current_date,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
grant select, insert, update, delete on public.stock_losses to authenticated;

create index stock_losses_location_date_idx on public.stock_losses (location_id, loss_date);
create index stock_losses_product_id_idx on public.stock_losses (product_id);

create trigger stock_losses_updated_at
  before update on public.stock_losses
  for each row execute function public.update_updated_at_column();

-- ============================================================
-- Investors, capital & profit distribution
-- ============================================================

create table public.investors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  user_id uuid references public.profiles (id),            -- most investors have no login
  share_link_token text not null unique default encode(gen_random_bytes(32), 'hex'),
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
grant select, insert, update, delete on public.investors to authenticated;

create trigger investors_updated_at
  before update on public.investors
  for each row execute function public.update_updated_at_column();

create table public.capital_entries (
  id uuid primary key default gen_random_uuid(),
  investor_id uuid not null references public.investors (id),
  business_id uuid references public.businesses (id),      -- NULL = invested in all of Kibali
  amount numeric(12,2) not null check (amount > 0),
  entry_type capital_entry_type not null default 'investment',
  entry_date date not null default current_date,
  notes text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
grant select, insert, update, delete on public.capital_entries to authenticated;

create index capital_entries_investor_id_idx on public.capital_entries (investor_id);
create index capital_entries_business_id_idx on public.capital_entries (business_id);

create trigger capital_entries_updated_at
  before update on public.capital_entries
  for each row execute function public.update_updated_at_column();

create table public.profit_distributions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses (id),      -- NULL = all of Kibali
  period_label text not null,                              -- "June 2026"
  total_profit numeric(12,2) not null check (total_profit >= 0),
  distribution_date date not null default current_date,
  status distribution_status not null default 'draft',
  notes text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
grant select, insert, update, delete on public.profit_distributions to authenticated;

create index profit_distributions_business_id_idx on public.profit_distributions (business_id);

create trigger profit_distributions_updated_at
  before update on public.profit_distributions
  for each row execute function public.update_updated_at_column();

create table public.distribution_allocations (
  id uuid primary key default gen_random_uuid(),
  distribution_id uuid not null references public.profit_distributions (id) on delete cascade,
  investor_id uuid not null references public.investors (id),
  share_pct numeric(7,4) not null check (share_pct >= 0 and share_pct <= 100),
  amount numeric(12,2) not null check (amount >= 0),
  status allocation_status not null default 'pending',
  settled_on date,                                         -- dated Disburse / Return action
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (distribution_id, investor_id)
);
grant select, insert, update, delete on public.distribution_allocations to authenticated;

create index distribution_allocations_investor_id_idx
  on public.distribution_allocations (investor_id);

create trigger distribution_allocations_updated_at
  before update on public.distribution_allocations
  for each row execute function public.update_updated_at_column();

-- ============================================================
-- Audit log — append-only, forever
-- ============================================================

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles (id),
  action text not null,          -- "sale.created", "allocation.disbursed"...
  entity text not null,          -- "sale", "delivery", "distribution"...
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
-- INSERT + SELECT only. No UPDATE/DELETE grants — for anyone, ever.
grant select, insert on public.audit_logs to authenticated;

create index audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index audit_logs_actor_id_idx on public.audit_logs (actor_id);
