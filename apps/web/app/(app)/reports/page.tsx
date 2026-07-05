import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import type { DailyLocationSummary, ExpenseCategory } from "@kibali/shared";
import { EXPENSE_LABELS, formatKES } from "@kibali/shared";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { adjacentMonth, currentMonthKey, monthRange, totalsFor } from "@/lib/summaries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminTable, MobileCard, MobileField, Td } from "@/components/ui/admin-table";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ business?: string; month?: string }>;
}) {
  await requireOwner();
  const { business: businessId, month: monthParam } = await searchParams;
  const month = monthParam ?? currentMonthKey();
  const { start, end, label } = monthRange(month);

  const supabase = await createClient();
  let locationsQuery = supabase
    .from("locations")
    .select("id, business_id, name")
    .is("deleted_at", null);
  if (businessId) locationsQuery = locationsQuery.eq("business_id", businessId);
  // Independent queries — one round-trip instead of two.
  const [{ data: businesses }, { data: locations }] = await Promise.all([
    supabase.from("businesses").select("id, name").is("deleted_at", null).order("name"),
    locationsQuery,
  ]);
  const locationIds = (locations ?? []).map((l) => l.id);

  const [dailyRes, expensesRes] = await Promise.all([
    locationIds.length
      ? supabase
          .from("v_daily_location_summary")
          .select("*")
          .in("location_id", locationIds)
          .gte("day", start)
          .lt("day", end)
      : Promise.resolve({ data: [] }),
    locationIds.length
      ? supabase
          .from("expenses")
          .select("location_id, category, amount")
          .in("location_id", locationIds)
          .gte("expense_date", start)
          .lt("expense_date", end)
          .is("deleted_at", null)
      : Promise.resolve({ data: [] }),
  ]);

  const daily = (dailyRes.data ?? []) as DailyLocationSummary[];
  const expenses = (expensesRes.data ?? []) as { location_id: string; category: ExpenseCategory; amount: number }[];

  const totals = totalsFor(daily);
  const cogsTotal = daily.reduce((sum, r) => sum + Number(r.cogs_total), 0);
  const lossTotal = daily.reduce((sum, r) => sum + Number(r.loss_value), 0);
  const cashExpenseTotal = daily.reduce((sum, r) => sum + Number(r.cash_expenses), 0);
  const grossProfit = totals.sales - cogsTotal;

  const categoryTotals = new Map<ExpenseCategory, number>();
  for (const e of expenses) {
    categoryTotals.set(e.category, (categoryTotals.get(e.category) ?? 0) + Number(e.amount));
  }

  const perLocation = (locations ?? []).map((l) => {
    const t = totalsFor(daily, (r) => r.location_id === l.id);
    return { ...l, ...t };
  });

  const scopeQuery = businessId ? `&business=${businessId}` : "";
  const prevMonth = adjacentMonth(month, -1);
  const nextMonth = adjacentMonth(month, 1);
  const isCurrentMonth = month >= currentMonthKey();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Link href="/dashboard" aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Business Statement</h1>
          <p className="text-sm text-muted-foreground">See how the business performed.</p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <Link
          href={`/reports?month=${month}`}
          className={`shrink-0 rounded px-3 py-2 text-sm font-semibold ${
            !businessId ? "bg-primary text-primary-foreground" : "border bg-background"
          }`}
        >
          All businesses
        </Link>
        {(businesses ?? []).map((b) => (
          <Link
            key={b.id}
            href={`/reports?month=${month}&business=${b.id}`}
            className={`shrink-0 rounded px-3 py-2 text-sm font-semibold ${
              businessId === b.id ? "bg-primary text-primary-foreground" : "border bg-background"
            }`}
          >
            {b.name}
          </Link>
        ))}
      </div>

      <div className="flex items-center justify-between rounded border bg-background p-2">
        <Link
          href={`/reports?month=${prevMonth}${scopeQuery}`}
          aria-label="Previous month"
          className="flex h-10 w-10 items-center justify-center rounded hover:bg-muted"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <span className="font-semibold">{label}</span>
        {isCurrentMonth ? (
          <span className="flex h-10 w-10 items-center justify-center text-muted-foreground/30">
            <ChevronRight className="h-5 w-5" />
          </span>
        ) : (
          <Link
            href={`/reports?month=${nextMonth}${scopeQuery}`}
            aria-label="Next month"
            className="flex h-10 w-10 items-center justify-center rounded hover:bg-muted"
          >
            <ChevronRight className="h-5 w-5" />
          </Link>
        )}
      </div>

      <Card className="bg-gradient-to-br from-slate-700 to-slate-900 text-white shadow-md">
        <CardContent className="grid grid-cols-2 gap-4 p-4">
          <div>
            <div className="text-sm text-white/80">Net profit</div>
            <div className="text-2xl font-bold">{formatKES(totals.profit)}</div>
          </div>
          <div>
            <div className="text-sm text-white/80">Total sales</div>
            <div className="text-2xl font-bold">{formatKES(totals.sales)}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Statement — {label}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y text-sm">
          <Row label="Sales" value={totals.sales} />
          <Row label="Cost of goods sold" value={-cogsTotal} />
          <Row label="Gross profit" value={grossProfit} bold />
          {(Object.keys(EXPENSE_LABELS) as ExpenseCategory[]).map((c) => (
            <Row key={c} label={`  ${EXPENSE_LABELS[c]}`} value={-(categoryTotals.get(c) ?? 0)} muted />
          ))}
          <Row label="Total expenses" value={-cashExpenseTotal} />
          <Row label="Spoiled / lost stock" value={-lossTotal} />
          <Row label="Net profit" value={totals.profit} bold tone />
        </CardContent>
      </Card>

      {perLocation.length > 1 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">By shop</h2>
          <AdminTable
            headers={["Shop", "Sales", "Spent", "Profit"]}
            mobile={perLocation.map((l) => (
              <MobileCard key={l.id} className="gap-1.5">
                <div className="font-semibold">{l.name}</div>
                <MobileField label="Sales">{formatKES(l.sales)}</MobileField>
                <MobileField label="Spent">{formatKES(l.spent)}</MobileField>
                <MobileField label="Profit">
                  <span className={l.profit >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                    {formatKES(l.profit)}
                  </span>
                </MobileField>
              </MobileCard>
            ))}
          >
            {perLocation.map((l) => (
              <tr key={l.id}>
                <Td className="font-medium">{l.name}</Td>
                <Td>{formatKES(l.sales)}</Td>
                <Td>{formatKES(l.spent)}</Td>
                <Td className={l.profit >= 0 ? "text-emerald-700" : "text-red-600"}>
                  {formatKES(l.profit)}
                </Td>
              </tr>
            ))}
          </AdminTable>
        </section>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  muted,
  tone,
}: {
  label: string;
  value: number;
  bold?: boolean;
  muted?: boolean;
  tone?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between py-2 ${bold ? "font-bold" : ""}`}>
      <span className={muted ? "text-muted-foreground" : ""}>{label}</span>
      <span className={tone ? (value >= 0 ? "text-emerald-700" : "text-red-600") : ""}>
        {value < 0 ? `(${formatKES(Math.abs(value))})` : formatKES(value)}
      </span>
    </div>
  );
}
