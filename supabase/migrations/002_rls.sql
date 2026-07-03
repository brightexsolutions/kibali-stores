-- ============================================================
-- Kibali Stores — 002_rls.sql
-- Row-Level Security: helpers + full policy matrix.
-- Managers physically cannot read/write outside their location.
-- Super admin + owners see all (is_owner() is true for both).
-- ============================================================

-- ---------- Helpers (SECURITY DEFINER avoids policy recursion) ----------

create or replace function public.is_owner()
returns boolean
language sql
security definer stable
set search_path = public
as $$
  select exists (
    select 1 from members
    where user_id = auth.uid()
      and role in ('super_admin', 'owner')
      and is_active
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
security definer stable
set search_path = public
as $$
  select exists (
    select 1 from members
    where user_id = auth.uid()
      and role = 'super_admin'
      and is_active
  );
$$;

-- NULL location = the Main store: owners only.
create or replace function public.can_access_location(loc uuid)
returns boolean
language sql
security definer stable
set search_path = public
as $$
  select public.is_owner()
    or (
      loc is not null and exists (
        select 1 from members
        where user_id = auth.uid()
          and role = 'manager'
          and location_id = loc
          and is_active
      )
    );
$$;

create or replace function public.can_access_business(biz uuid)
returns boolean
language sql
security definer stable
set search_path = public
as $$
  select public.is_owner()
    or exists (
      select 1
      from members m
      join locations l on l.id = m.location_id
      where m.user_id = auth.uid()
        and m.role = 'manager'
        and m.is_active
        and l.business_id = biz
    );
$$;

-- ---------- Enable RLS everywhere ----------

alter table public.profiles enable row level security;
alter table public.members enable row level security;
alter table public.businesses enable row level security;
alter table public.locations enable row level security;
alter table public.suppliers enable row level security;
alter table public.products enable row level security;
alter table public.deliveries enable row level security;
alter table public.delivery_items enable row level security;
alter table public.stock_distributions enable row level security;
alter table public.supplier_payments enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.expenses enable row level security;
alter table public.stock_losses enable row level security;
alter table public.investors enable row level security;
alter table public.capital_entries enable row level security;
alter table public.profit_distributions enable row level security;
alter table public.distribution_allocations enable row level security;
alter table public.audit_logs enable row level security;

-- ---------- profiles ----------
create policy profiles_select on public.profiles
  for select using (id = auth.uid() or public.is_owner());
create policy profiles_update on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

-- ---------- members (accounts are created server-side via admin client) ----------
create policy members_select on public.members
  for select using (user_id = auth.uid() or public.is_owner());
create policy members_write on public.members
  for all using (public.is_super_admin())
  with check (public.is_super_admin());

-- ---------- structure & catalog: read by business scope, write by owners ----------
create policy businesses_select on public.businesses
  for select using (public.can_access_business(id));
create policy businesses_write on public.businesses
  for all using (public.is_owner()) with check (public.is_owner());

create policy locations_select on public.locations
  for select using (public.can_access_business(business_id));
create policy locations_write on public.locations
  for all using (public.is_owner()) with check (public.is_owner());

create policy suppliers_select on public.suppliers
  for select using (public.can_access_business(business_id));
create policy suppliers_write on public.suppliers
  for all using (public.is_owner()) with check (public.is_owner());

create policy products_select on public.products
  for select using (public.can_access_business(business_id));
create policy products_write on public.products
  for all using (public.is_owner()) with check (public.is_owner());

-- ---------- record tables ----------
-- Pattern: SELECT + INSERT within your location; UPDATE by owners always,
-- or by the manager who created the row, same-day only (edits/soft-deletes);
-- hard DELETE is owner-only (normal "delete" is a soft-delete UPDATE).

-- deliveries (location NULL = Main store → owners only via can_access_location)
create policy deliveries_select on public.deliveries
  for select using (public.can_access_location(location_id));
create policy deliveries_insert on public.deliveries
  for insert with check (
    public.can_access_location(location_id) and created_by = auth.uid()
  );
create policy deliveries_update on public.deliveries
  for update using (
    public.is_owner()
    or (created_by = auth.uid()
        and public.can_access_location(location_id)
        and created_at::date = current_date)
  );
create policy deliveries_delete on public.deliveries
  for delete using (public.is_owner());

-- delivery_items — via parent delivery
create policy delivery_items_select on public.delivery_items
  for select using (
    exists (select 1 from public.deliveries d
            where d.id = delivery_id
              and public.can_access_location(d.location_id))
  );
create policy delivery_items_insert on public.delivery_items
  for insert with check (
    exists (select 1 from public.deliveries d
            where d.id = delivery_id
              and public.can_access_location(d.location_id))
  );
create policy delivery_items_update on public.delivery_items
  for update using (
    public.is_owner()
    or exists (select 1 from public.deliveries d
               where d.id = delivery_id
                 and d.created_by = auth.uid()
                 and d.created_at::date = current_date)
  );
create policy delivery_items_delete on public.delivery_items
  for delete using (
    public.is_owner()
    or exists (select 1 from public.deliveries d
               where d.id = delivery_id
                 and d.created_by = auth.uid()
                 and d.created_at::date = current_date)
  );

-- stock_distributions — owners send stock; managers may see what arrived
create policy stock_distributions_select on public.stock_distributions
  for select using (public.can_access_location(location_id));
create policy stock_distributions_write on public.stock_distributions
  for all using (public.is_owner()) with check (public.is_owner());

-- supplier_payments — owners freely; managers only alongside their own delivery
create policy supplier_payments_select on public.supplier_payments
  for select using (
    exists (select 1 from public.suppliers s
            where s.id = supplier_id
              and public.can_access_business(s.business_id))
  );
create policy supplier_payments_insert on public.supplier_payments
  for insert with check (
    created_by = auth.uid()
    and (
      public.is_owner()
      or exists (select 1 from public.deliveries d
                 where d.id = delivery_id
                   and public.can_access_location(d.location_id))
    )
  );
create policy supplier_payments_update on public.supplier_payments
  for update using (public.is_owner());
create policy supplier_payments_delete on public.supplier_payments
  for delete using (public.is_owner());

-- sales
create policy sales_select on public.sales
  for select using (public.can_access_location(location_id));
create policy sales_insert on public.sales
  for insert with check (
    public.can_access_location(location_id) and created_by = auth.uid()
  );
create policy sales_update on public.sales
  for update using (
    public.is_owner()
    or (created_by = auth.uid()
        and public.can_access_location(location_id)
        and created_at::date = current_date)
  );
create policy sales_delete on public.sales
  for delete using (public.is_owner());

-- sale_items — via parent sale
create policy sale_items_select on public.sale_items
  for select using (
    exists (select 1 from public.sales s
            where s.id = sale_id
              and public.can_access_location(s.location_id))
  );
create policy sale_items_insert on public.sale_items
  for insert with check (
    exists (select 1 from public.sales s
            where s.id = sale_id
              and public.can_access_location(s.location_id))
  );
create policy sale_items_update on public.sale_items
  for update using (
    public.is_owner()
    or exists (select 1 from public.sales s
               where s.id = sale_id
                 and s.created_by = auth.uid()
                 and s.created_at::date = current_date)
  );
create policy sale_items_delete on public.sale_items
  for delete using (
    public.is_owner()
    or exists (select 1 from public.sales s
               where s.id = sale_id
                 and s.created_by = auth.uid()
                 and s.created_at::date = current_date)
  );

-- expenses
create policy expenses_select on public.expenses
  for select using (public.can_access_location(location_id));
create policy expenses_insert on public.expenses
  for insert with check (
    public.can_access_location(location_id) and created_by = auth.uid()
  );
create policy expenses_update on public.expenses
  for update using (
    public.is_owner()
    or (created_by = auth.uid()
        and public.can_access_location(location_id)
        and created_at::date = current_date)
  );
create policy expenses_delete on public.expenses
  for delete using (public.is_owner());

-- stock_losses
create policy stock_losses_select on public.stock_losses
  for select using (public.can_access_location(location_id));
create policy stock_losses_insert on public.stock_losses
  for insert with check (
    public.can_access_location(location_id) and created_by = auth.uid()
  );
create policy stock_losses_update on public.stock_losses
  for update using (
    public.is_owner()
    or (created_by = auth.uid()
        and public.can_access_location(location_id)
        and created_at::date = current_date)
  );
create policy stock_losses_delete on public.stock_losses
  for delete using (public.is_owner());

-- ---------- investor money: super_admin/owner only, managers get zero rows ----------
create policy investors_all on public.investors
  for all using (public.is_owner()) with check (public.is_owner());
create policy capital_entries_all on public.capital_entries
  for all using (public.is_owner()) with check (public.is_owner());
create policy profit_distributions_all on public.profit_distributions
  for all using (public.is_owner()) with check (public.is_owner());
create policy distribution_allocations_all on public.distribution_allocations
  for all using (public.is_owner()) with check (public.is_owner());

-- ---------- audit log: anyone can write their own actions, owners read ----------
create policy audit_logs_select on public.audit_logs
  for select using (public.is_owner());
create policy audit_logs_insert on public.audit_logs
  for insert with check (actor_id = auth.uid());
