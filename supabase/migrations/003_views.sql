-- ============================================================
-- Kibali Stores — 003_views.sql
-- All money/stock arithmetic lives here — one source of truth.
-- Every view: security_invoker so the caller's RLS applies.
-- Quantities are normalised to PIECES internally.
-- ============================================================

-- ------------------------------------------------------------
-- v_sale_summary — per sale: total, COGS, profit
-- ------------------------------------------------------------
create view public.v_sale_summary
with (security_invoker = true) as
select
  s.id as sale_id,
  s.location_id,
  s.sale_date,
  s.sale_type,
  s.created_by,
  coalesce(sum(si.quantity * si.unit_price), 0)::numeric(12,2) as total_amount,
  coalesce(sum(si.quantity * si.unit_cost), 0)::numeric(12,2)  as total_cost,
  coalesce(sum(si.quantity * (si.unit_price - si.unit_cost)), 0)::numeric(12,2) as profit
from sales s
left join sale_items si on si.sale_id = s.id
where s.deleted_at is null
group by s.id;

grant select on public.v_sale_summary to authenticated;

-- ------------------------------------------------------------
-- v_delivery_summary — per delivery: expected profit + payment state
-- Partial payments are always explicit: paid X of Y, still owed Z.
-- ------------------------------------------------------------
create view public.v_delivery_summary
with (security_invoker = true) as
select
  d.id as delivery_id,
  d.location_id,
  d.supplier_id,
  d.delivery_date,
  d.total_cost,
  coalesce(items.expected_revenue, 0)::numeric(12,2) as expected_revenue,
  (coalesce(items.expected_revenue, 0) - d.total_cost)::numeric(12,2) as expected_profit,
  coalesce(pay.amount_paid, 0)::numeric(12,2) as amount_paid,
  (d.total_cost - coalesce(pay.amount_paid, 0))::numeric(12,2) as balance_owed,
  case
    when coalesce(pay.amount_paid, 0) <= 0 then 'unpaid'
    when coalesce(pay.amount_paid, 0) < d.total_cost then 'partially_paid'
    else 'paid'
  end as payment_status
from deliveries d
left join lateral (
  select sum(di.quantity * di.unit_wholesale_price) as expected_revenue
  from delivery_items di
  where di.delivery_id = d.id
) items on true
left join lateral (
  select sum(sp.amount) as amount_paid
  from supplier_payments sp
  where sp.delivery_id = d.id and sp.deleted_at is null
) pay on true
where d.deleted_at is null;

grant select on public.v_delivery_summary to authenticated;

-- ------------------------------------------------------------
-- v_supplier_balances — per supplier: delivered − paid (incl. unlinked payments)
-- ------------------------------------------------------------
create view public.v_supplier_balances
with (security_invoker = true) as
select
  su.id as supplier_id,
  su.business_id,
  su.name,
  coalesce(del.total_delivered, 0)::numeric(12,2) as total_delivered,
  coalesce(pay.total_paid, 0)::numeric(12,2) as total_paid,
  (coalesce(del.total_delivered, 0) - coalesce(pay.total_paid, 0))::numeric(12,2) as balance_owed
from suppliers su
left join lateral (
  select sum(d.total_cost) as total_delivered
  from deliveries d
  where d.supplier_id = su.id and d.deleted_at is null
) del on true
left join lateral (
  select sum(sp.amount) as total_paid
  from supplier_payments sp
  where sp.supplier_id = su.id and sp.deleted_at is null
) pay on true
where su.deleted_at is null;

grant select on public.v_supplier_balances to authenticated;

-- ------------------------------------------------------------
-- v_stock_levels — pieces on hand per (location, product),
-- including the Main store (location_id NULL = undistributed central stock).
-- arrived (direct + distributed in, central in − distributed out) − sold − lost
-- ------------------------------------------------------------
create view public.v_stock_levels
with (security_invoker = true) as
with movements as (
  -- direct deliveries to a shop
  select d.location_id, di.product_id,
         (di.quantity * p.pieces_per_unit)::bigint as pieces
  from delivery_items di
  join deliveries d on d.id = di.delivery_id and d.deleted_at is null
  join products p on p.id = di.product_id
  where d.location_id is not null

  union all
  -- central deliveries land in the Main store (location NULL)
  select null::uuid, di.product_id,
         (di.quantity * p.pieces_per_unit)::bigint
  from delivery_items di
  join deliveries d on d.id = di.delivery_id and d.deleted_at is null
  join products p on p.id = di.product_id
  where d.location_id is null

  union all
  -- distributions: out of Main store …
  select null::uuid, sd.product_id,
         -(sd.quantity * p.pieces_per_unit)::bigint
  from stock_distributions sd
  join products p on p.id = sd.product_id
  where sd.deleted_at is null

  union all
  -- … into the shop
  select sd.location_id, sd.product_id,
         (sd.quantity * p.pieces_per_unit)::bigint
  from stock_distributions sd
  join products p on p.id = sd.product_id
  where sd.deleted_at is null

  union all
  -- sales out
  select s.location_id, si.product_id,
         -(si.quantity * case when si.unit_level = 'box' then p.pieces_per_unit else 1 end)::bigint
  from sale_items si
  join sales s on s.id = si.sale_id and s.deleted_at is null
  join products p on p.id = si.product_id

  union all
  -- losses out
  select sl.location_id, sl.product_id,
         -(sl.quantity * case when sl.unit_level = 'box' then p.pieces_per_unit else 1 end)::bigint
  from stock_losses sl
  join products p on p.id = sl.product_id
  where sl.deleted_at is null
)
select
  m.location_id,
  m.product_id,
  p.business_id,
  p.name as product_name,
  p.unit_name,
  p.piece_name,
  p.pieces_per_unit,
  p.wholesale_price,
  p.retail_price_per_piece,
  p.low_stock_threshold,
  p.reorder_buffer_days,
  sum(m.pieces)::bigint as pieces_on_hand,
  (sum(m.pieces) / p.pieces_per_unit)::bigint as boxes_on_hand,
  (sum(m.pieces) % p.pieces_per_unit)::bigint as loose_pieces
from movements m
join products p on p.id = m.product_id and p.deleted_at is null
group by m.location_id, m.product_id, p.id;

grant select on public.v_stock_levels to authenticated;

-- ------------------------------------------------------------
-- v_daily_location_summary — per (location, day):
-- actual_profit = sales − COGS − cash expenses − loss value
-- ------------------------------------------------------------
create view public.v_daily_location_summary
with (security_invoker = true) as
with day_facts as (
  select s.location_id, s.sale_date as day,
         si.quantity * si.unit_price as sales_amt,
         si.quantity * si.unit_cost as cogs_amt,
         0::numeric as expense_amt,
         0::numeric as loss_amt
  from sale_items si
  join sales s on s.id = si.sale_id and s.deleted_at is null

  union all
  select e.location_id, e.expense_date, 0, 0, e.amount, 0
  from expenses e
  where e.deleted_at is null

  union all
  select sl.location_id, sl.loss_date, 0, 0, 0, sl.quantity * sl.unit_cost
  from stock_losses sl
  where sl.deleted_at is null
)
select
  location_id,
  day,
  sum(sales_amt)::numeric(12,2)   as sales_total,
  sum(cogs_amt)::numeric(12,2)    as cogs_total,
  sum(expense_amt)::numeric(12,2) as cash_expenses,
  sum(loss_amt)::numeric(12,2)    as loss_value,
  (sum(sales_amt) - sum(cogs_amt) - sum(expense_amt) - sum(loss_amt))::numeric(12,2)
    as actual_profit
from day_facts
group by location_id, day;

grant select on public.v_daily_location_summary to authenticated;

-- ------------------------------------------------------------
-- v_delivery_progress — THE BATCH VIEW (family profit rule).
-- FIFO attribution, two stages:
--   1. central deliveries → distributions (which shop got which batch's boxes)
--   2. location arrival layers → sales/losses (what revenue each batch earned)
-- A delivery is Finished when no pieces remain (in shops or Main store).
-- realized_profit = attributed revenue − total_cost − attributed loss value.
-- ------------------------------------------------------------
create view public.v_delivery_progress
with (security_invoker = true) as
with
-- central (Main store) delivery layers, cumulative per product
central_layers as (
  select
    d.id as delivery_id, di.product_id,
    (di.quantity * p.pieces_per_unit)::bigint as pieces,
    sum((di.quantity * p.pieces_per_unit)::bigint)
      over (partition by di.product_id
            order by d.delivery_date, d.created_at, di.created_at, di.id
            rows unbounded preceding) as cum_end
  from delivery_items di
  join deliveries d on d.id = di.delivery_id and d.deleted_at is null
  join products p on p.id = di.product_id
  where d.location_id is null
),
-- FIFO-attributed distributions (no explicit delivery link), cumulative per product
dist_events as (
  select
    sd.id as dist_id, sd.location_id, sd.product_id,
    sd.distribution_date, sd.created_at,
    (sd.quantity * p.pieces_per_unit)::bigint as pieces,
    sum((sd.quantity * p.pieces_per_unit)::bigint)
      over (partition by sd.product_id
            order by sd.distribution_date, sd.created_at, sd.id
            rows unbounded preceding) as cum_end
  from stock_distributions sd
  join products p on p.id = sd.product_id
  where sd.deleted_at is null and sd.delivery_id is null
),
dist_fifo as (
  -- interval intersection: which central layer fed which distribution
  select
    cl.delivery_id, de.location_id, de.product_id,
    least(cl.cum_end, de.cum_end)
      - greatest(cl.cum_end - cl.pieces, de.cum_end - de.pieces) as pieces,
    de.distribution_date as arrive_date, de.created_at as arrive_at
  from dist_events de
  join central_layers cl on cl.product_id = de.product_id
  where least(cl.cum_end, de.cum_end)
      > greatest(cl.cum_end - cl.pieces, de.cum_end - de.pieces)
),
-- location arrival layers, each tagged with its source delivery
location_layers as (
  -- direct-to-shop deliveries
  select d.id as delivery_id, d.location_id, di.product_id,
         (di.quantity * p.pieces_per_unit)::bigint as pieces,
         d.delivery_date as arrive_date, d.created_at as arrive_at
  from delivery_items di
  join deliveries d on d.id = di.delivery_id and d.deleted_at is null
  join products p on p.id = di.product_id
  where d.location_id is not null

  union all
  -- distributions explicitly linked to a delivery
  select sd.delivery_id, sd.location_id, sd.product_id,
         (sd.quantity * p.pieces_per_unit)::bigint,
         sd.distribution_date, sd.created_at
  from stock_distributions sd
  join products p on p.id = sd.product_id
  where sd.deleted_at is null and sd.delivery_id is not null

  union all
  -- FIFO-attributed distributions
  select delivery_id, location_id, product_id, pieces, arrive_date, arrive_at
  from dist_fifo
),
layer_cum as (
  select ll.*,
         sum(pieces) over (partition by location_id, product_id
                           order by arrive_date, arrive_at, delivery_id
                           rows unbounded preceding) as cum_end
  from location_layers ll
),
-- consumption events (sales + losses) per (location, product), cumulative
consumption as (
  select * from (
    select
      s.location_id, si.product_id,
      (si.quantity * case when si.unit_level = 'box' then p.pieces_per_unit else 1 end)::bigint
        as pieces,
      -- per-piece values so box and piece sales attribute alike
      (si.unit_price / case when si.unit_level = 'box' then p.pieces_per_unit else 1 end)::numeric
        as revenue_per_piece,
      0::numeric as loss_per_piece,
      s.sale_date as event_date, si.created_at as event_at
    from sale_items si
    join sales s on s.id = si.sale_id and s.deleted_at is null
    join products p on p.id = si.product_id

    union all
    select
      sl.location_id, sl.product_id,
      (sl.quantity * case when sl.unit_level = 'box' then p.pieces_per_unit else 1 end)::bigint,
      0::numeric,
      (sl.unit_cost / case when sl.unit_level = 'box' then p.pieces_per_unit else 1 end)::numeric,
      sl.loss_date, sl.created_at
    from stock_losses sl
    join products p on p.id = sl.product_id
    where sl.deleted_at is null
  ) c
),
consumption_cum as (
  select c.*,
         sum(pieces) over (partition by location_id, product_id
                           order by event_date, event_at
                           rows unbounded preceding) as cum_end
  from consumption c
),
-- interval intersection: attribute every consumed piece to its FIFO layer
attributed as (
  select
    lc.delivery_id,
    least(lc.cum_end, cc.cum_end)
      - greatest(lc.cum_end - lc.pieces, cc.cum_end - cc.pieces) as pieces,
    cc.revenue_per_piece,
    cc.loss_per_piece
  from layer_cum lc
  join consumption_cum cc
    on cc.product_id = lc.product_id
   and (cc.location_id = lc.location_id)
  where least(lc.cum_end, cc.cum_end)
      > greatest(lc.cum_end - lc.pieces, cc.cum_end - cc.pieces)
),
per_delivery as (
  select
    delivery_id,
    sum(pieces) as consumed_pieces,
    sum(pieces * revenue_per_piece) as realized_revenue,
    sum(pieces * loss_per_piece) as attributed_loss_value,
    sum(case when revenue_per_piece > 0 then pieces else 0 end) as sold_pieces,
    sum(case when loss_per_piece > 0 then pieces else 0 end) as lost_pieces
  from attributed
  group by delivery_id
),
delivery_totals as (
  select d.id as delivery_id,
         sum((di.quantity * p.pieces_per_unit)::bigint) as total_pieces
  from deliveries d
  join delivery_items di on di.delivery_id = d.id
  join products p on p.id = di.product_id
  where d.deleted_at is null
  group by d.id
)
select
  d.id as delivery_id,
  d.location_id,
  d.supplier_id,
  d.delivery_date,
  d.total_cost,
  coalesce(dt.total_pieces, 0) as total_pieces,
  coalesce(pd.sold_pieces, 0) as sold_pieces,
  coalesce(pd.lost_pieces, 0) as lost_pieces,
  greatest(coalesce(dt.total_pieces, 0) - coalesce(pd.consumed_pieces, 0), 0) as pieces_remaining,
  case
    when coalesce(dt.total_pieces, 0) > 0
     and coalesce(pd.consumed_pieces, 0) >= dt.total_pieces then 'finished'
    else 'selling'
  end as status,
  coalesce(pd.realized_revenue, 0)::numeric(12,2) as realized_revenue,
  coalesce(pd.attributed_loss_value, 0)::numeric(12,2) as attributed_loss_value,
  -- while selling this is "profit so far"; once finished it is the banked profit
  (coalesce(pd.realized_revenue, 0) - d.total_cost
     - coalesce(pd.attributed_loss_value, 0))::numeric(12,2) as realized_profit
from deliveries d
left join delivery_totals dt on dt.delivery_id = d.id
left join per_delivery pd on pd.delivery_id = d.id
where d.deleted_at is null;

grant select on public.v_delivery_progress to authenticated;

-- ------------------------------------------------------------
-- v_reorder_status — "Order soon" intelligence per (location, product)
-- rate = pieces consumed/day over the last 14 days
-- ------------------------------------------------------------
create view public.v_reorder_status
with (security_invoker = true) as
with recent_consumption as (
  select s.location_id, si.product_id,
         sum(si.quantity * case when si.unit_level = 'box' then p.pieces_per_unit else 1 end)
           as pieces_14d
  from sale_items si
  join sales s on s.id = si.sale_id and s.deleted_at is null
  join products p on p.id = si.product_id
  where s.sale_date >= current_date - 13
  group by s.location_id, si.product_id
),
last_order as (
  select distinct on (di.product_id)
         di.product_id,
         di.quantity as last_order_boxes,
         d.delivery_date as last_order_date
  from delivery_items di
  join deliveries d on d.id = di.delivery_id and d.deleted_at is null
  order by di.product_id, d.delivery_date desc, d.created_at desc
)
select
  sl.location_id,
  sl.product_id,
  sl.business_id,
  sl.product_name,
  sl.unit_name,
  sl.pieces_per_unit,
  sl.pieces_on_hand,
  sl.boxes_on_hand,
  sl.loose_pieces,
  round(coalesce(rc.pieces_14d, 0) / 14.0, 1) as pieces_per_day,
  case
    when coalesce(rc.pieces_14d, 0) > 0
      then round(sl.pieces_on_hand / (rc.pieces_14d / 14.0), 1)
  end as days_of_stock_left,
  lo.last_order_boxes,
  lo.last_order_date,
  -- suggestion: last order size, scaled up if selling faster than it lasted
  case
    when lo.last_order_boxes is not null then greatest(
      lo.last_order_boxes,
      ceil(coalesce(rc.pieces_14d, 0) / 14.0 * 14 / nullif(sl.pieces_per_unit, 0))::int
    )
  end as suggested_order_boxes,
  (
    sl.boxes_on_hand <= sl.low_stock_threshold
    or (
      coalesce(rc.pieces_14d, 0) > 0
      and sl.pieces_on_hand / (rc.pieces_14d / 14.0) <= sl.reorder_buffer_days
    )
  ) as order_soon
from v_stock_levels sl
left join recent_consumption rc
  on rc.location_id is not distinct from sl.location_id
 and rc.product_id = sl.product_id
left join last_order lo on lo.product_id = sl.product_id;

grant select on public.v_reorder_status to authenticated;

-- ------------------------------------------------------------
-- v_investor_summary — capital, share %, paid out, returned, pending
-- ------------------------------------------------------------
create view public.v_investor_summary
with (security_invoker = true) as
with capital as (
  select investor_id, sum(amount) as capital
  from capital_entries
  where deleted_at is null
  group by investor_id
),
totals as (
  select sum(amount) as total_capital
  from capital_entries
  where deleted_at is null
),
alloc as (
  select investor_id,
         sum(amount) filter (where status = 'disbursed') as total_disbursed,
         sum(amount) filter (where status = 'returned_to_business') as total_returned,
         sum(amount) filter (where status = 'pending') as pending_amount,
         count(*) filter (where status = 'pending') as pending_count
  from distribution_allocations
  group by investor_id
)
select
  i.id as investor_id,
  i.name,
  i.phone,
  i.user_id,
  i.is_active,
  coalesce(c.capital, 0)::numeric(12,2) as capital,
  case when coalesce(t.total_capital, 0) > 0
    then round(coalesce(c.capital, 0) / t.total_capital * 100, 2)
    else 0
  end as share_pct,
  coalesce(a.total_disbursed, 0)::numeric(12,2) as total_disbursed,
  coalesce(a.total_returned, 0)::numeric(12,2) as total_returned,
  coalesce(a.pending_amount, 0)::numeric(12,2) as pending_amount,
  coalesce(a.pending_count, 0) as pending_count
from investors i
left join capital c on c.investor_id = i.id
left join alloc a on a.investor_id = i.id
cross join totals t
where i.deleted_at is null;

grant select on public.v_investor_summary to authenticated;

-- ------------------------------------------------------------
-- v_capital_history — dated timeline per investor:
-- running capital after each entry + the share % it produced at that moment,
-- so it's visible how each add-up changed the next profit split.
-- ------------------------------------------------------------
create view public.v_capital_history
with (security_invoker = true) as
with ordered as (
  select
    ce.id as entry_id,
    ce.investor_id,
    ce.business_id,
    ce.amount,
    ce.entry_type,
    ce.entry_date,
    ce.notes,
    ce.created_at,
    sum(ce.amount) over (
      partition by ce.investor_id
      order by ce.entry_date, ce.created_at
      rows unbounded preceding
    ) as running_capital,
    sum(ce.amount) over (
      order by ce.entry_date, ce.created_at
      rows unbounded preceding
    ) as running_total_capital
  from capital_entries ce
  where ce.deleted_at is null
)
select
  o.*,
  i.name as investor_name,
  round(o.running_capital / nullif(o.running_total_capital, 0) * 100, 2)
    as share_pct_after
from ordered o
join investors i on i.id = o.investor_id and i.deleted_at is null;

grant select on public.v_capital_history to authenticated;
