import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Banknote, PackagePlus, ShoppingCart, Snowflake } from "lucide-react";
import type { DailyLocationSummary, ReorderStatus, StockLevel } from "@kibali/shared";
import { formatKES } from "@kibali/shared";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { currentMonthKey, monthKey, sixMonthsAgoISO, toMonthlyPoints, totalsFor } from "@/lib/summaries";
import { MonthlyBars } from "@/components/charts/monthly-bars";
import { DayBrief } from "@/components/day-brief";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const QUICK = [
  { href: "/sale/new", label: "Record a Sale", icon: ShoppingCart },
  { href: "/expense/new", label: "Money Spent", icon: Banknote },
  { href: "/delivery/new", label: "Stock Arrived", icon: PackagePlus },
  { href: "/loss/new", label: "Spoiled / Lost", icon: Snowflake },
];

export default async function LocationDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOwner();
  const { id } = await params;
  const supabase = await createClient();

  const yesterdayDate = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  // Everything filters by the id directly, so nothing needs to wait for the
  // location row — one round-trip instead of two.
  const [locationRes, dailyRes, stockRes, reorderRes] = await Promise.all([
    supabase
      .from("locations")
      .select("id, name, business_id, businesses(name)")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase.from("v_daily_location_summary").select("*").eq("location_id", id).gte("day", sixMonthsAgoISO()),
    supabase.from("v_stock_levels").select("*").eq("location_id", id).order("product_name"),
    supabase.from("v_reorder_status").select("*").eq("location_id", id).eq("order_soon", true),
  ]);
  const location = locationRes.data;
  if (!location) notFound();
  const businessName = (location.businesses as unknown as { name: string })?.name ?? "";

  const daily = (dailyRes.data ?? []) as DailyLocationSummary[];
  const stock = (stockRes.data ?? []) as StockLevel[];
  const alerts = (reorderRes.data ?? []) as ReorderStatus[];
  const today = new Date().toISOString().slice(0, 10);
  const todayTotals = totalsFor(daily, (r) => r.day === today);
  const monthTotals = totalsFor(daily, (r) => monthKey(r.day) === currentMonthKey());
  const yesterday = totalsFor(daily, (r) => r.day === yesterdayDate);
  const q = `?location=${id}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Link href={`/dashboard/business/${location.business_id}`} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{location.name}</h1>
          <p className="text-sm text-muted-foreground">{businessName}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <StatCard title="Sales today" value={formatKES(todayTotals.sales)} hint={`profit ${formatKES(todayTotals.profit)}`} />
        <StatCard title="This month" value={formatKES(monthTotals.sales)} hint={`profit ${formatKES(monthTotals.profit)}`} tone="primary" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {QUICK.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={`${href}${q}`}
            className="flex h-14 items-center justify-center gap-2 rounded border bg-background font-semibold hover:bg-muted"
          >
            <Icon className="h-5 w-5" /> {label}
          </Link>
        ))}
      </div>

      <DayBrief
        yesterday={{ sales_total: yesterday.sales, actual_profit: yesterday.profit }}
        stockLineCount={stock.length}
        totalBoxes={stock.reduce((sum, s) => sum + Number(s.boxes_on_hand), 0)}
        alerts={alerts}
        locationQuery={q}
      />

      <Card>
        <CardHeader>
          <CardTitle>Last 6 months</CardTitle>
          <CardDescription>This shop only.</CardDescription>
        </CardHeader>
        <CardContent>
          <MonthlyBars data={toMonthlyPoints(daily)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stock here</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {stock.length === 0 && (
            <p className="text-sm text-muted-foreground">No stock at this shop yet.</p>
          )}
          {stock.map((s) => (
            <div key={s.product_id} className="flex items-center justify-between rounded border bg-background p-3 text-sm">
              <span className="font-medium">{s.product_name}</span>
              <span className="flex items-center gap-2">
                {s.boxes_on_hand} {s.unit_name}s
                {Number(s.loose_pieces) > 0 && ` + ${s.loose_pieces} pieces`}
                {Number(s.boxes_on_hand) <= s.low_stock_threshold && <Badge variant="bad">Low</Badge>}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Link href={`/today${q}`} className="rounded border bg-background p-3 text-center text-sm font-medium hover:bg-muted">
        See today&apos;s records for this shop
      </Link>
    </div>
  );
}
