import Link from "next/link";
import { Building2, ChevronRight, TrendingUp, Truck, Wallet } from "lucide-react";
import type {
  DailyLocationSummary,
  DeliveryProgress,
  ReorderStatus,
  StockLevel,
  SupplierBalance,
} from "@kibali/shared";
import { formatKES } from "@kibali/shared";
import { requireOwner } from "@/lib/auth";
import { listAccessibleLocations } from "@/lib/location";
import { createClient } from "@/lib/supabase/server";
import { currentMonthKey, monthKey, sixMonthsAgoISO, toMonthlyPoints, totalsFor } from "@/lib/summaries";
import { greeting } from "@/lib/utils";
import { MonthlyBars } from "@/components/charts/monthly-bars";
import { BatchStrip } from "@/components/batch-strip";
import { DayBrief } from "@/components/day-brief";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const member = await requireOwner();
  const firstName = member.fullName.split(" ")[0] || member.fullName;
  const supabase = await createClient();
  const locations = await listAccessibleLocations(member);
  const yesterdayDate = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

  const [dailyRes, batchesRes, balancesRes, suppliersRes, stockRes, reorderRes, businessesRes] =
    await Promise.all([
      supabase.from("v_daily_location_summary").select("*").gte("day", sixMonthsAgoISO()),
      supabase.from("v_delivery_progress").select("*").order("delivery_date", { ascending: false }).limit(12),
      supabase.from("v_supplier_balances").select("*"),
      supabase.from("suppliers").select("id, name").is("deleted_at", null),
      supabase.from("v_stock_levels").select("*"),
      supabase.from("v_reorder_status").select("*").eq("order_soon", true).limit(6),
      supabase.from("businesses").select("id, name, description").is("deleted_at", null).order("name"),
    ]);

  const daily = (dailyRes.data ?? []) as DailyLocationSummary[];
  const batches = (batchesRes.data ?? []) as DeliveryProgress[];
  const balances = (balancesRes.data ?? []) as SupplierBalance[];
  const stock = (stockRes.data ?? []) as StockLevel[];
  const alerts = (reorderRes.data ?? []) as ReorderStatus[];
  const businesses = businessesRes.data ?? [];

  const thisMonth = totalsFor(daily, (r) => monthKey(r.day) === currentMonthKey());
  const profitBanked = batches
    .filter((b) => b.status === "finished")
    .reduce((sum, b) => sum + Number(b.realized_profit), 0);
  const totalOwed = balances.reduce((sum, b) => sum + Math.max(0, Number(b.balance_owed)), 0);
  const supplierNames = new Map((suppliersRes.data ?? []).map((s) => [s.id, s.name] as const));
  const yesterday = totalsFor(daily, (r) => r.day === yesterdayDate);

  const locationIdsByBusiness = new Map<string, string[]>();
  for (const l of locations) {
    locationIdsByBusiness.set(l.business_id, [
      ...(locationIdsByBusiness.get(l.business_id) ?? []),
      l.id,
    ]);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">
          {greeting()}, {firstName} 👋
        </h1>
        <p className="text-sm text-muted-foreground">All of Kibali Stores at a glance.</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <StatCard
          title="Money in this month"
          value={formatKES(thisMonth.sales)}
          hint="all sales, every shop"
          tone="info"
          icon={Wallet}
        />
        <StatCard
          title="Profit banked"
          value={formatKES(profitBanked)}
          hint="supplies that finished selling"
          tone="primary"
          icon={TrendingUp}
        />
        <StatCard title="Money spent this month" value={formatKES(thisMonth.spent)} hint="expenses + spoiled stock" />
        <StatCard
          title="Owed to suppliers"
          value={formatKES(totalOwed)}
          hint={totalOwed > 0 ? "tap Suppliers to see who" : "nothing outstanding"}
          tone={totalOwed > 0 ? "warn" : "default"}
          icon={Truck}
        />
      </div>

      <DayBrief
        yesterday={{ sales_total: yesterday.sales, actual_profit: yesterday.profit }}
        stockLineCount={stock.filter((s) => s.location_id !== null).length}
        totalBoxes={stock.reduce((sum, s) => sum + Number(s.boxes_on_hand), 0)}
        alerts={alerts}
      />

      <Card>
        <CardHeader>
          <CardTitle>Last 6 months</CardTitle>
          <CardDescription>Money in vs money spent vs profit, month by month.</CardDescription>
        </CardHeader>
        <CardContent>
          <MonthlyBars data={toMonthlyPoints(daily)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stock batches</CardTitle>
          <CardDescription>
            Each supply from a supplier — profit is banked when the batch finishes selling.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BatchStrip batches={batches} supplierNames={supplierNames} />
        </CardContent>
      </Card>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Your businesses</h2>
        {businesses.map((b) => {
          const ids = locationIdsByBusiness.get(b.id) ?? [];
          const totals = totalsFor(
            daily,
            (r) => ids.includes(r.location_id) && monthKey(r.day) === currentMonthKey()
          );
          return (
            <Link key={b.id} href={`/dashboard/business/${b.id}`}>
              <Card className="hover:bg-muted/50">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-6 w-6 text-primary" />
                    <div>
                      <div className="font-semibold">{b.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {ids.length} shop{ids.length === 1 ? "" : "s"} · this month:{" "}
                        {formatKES(totals.sales)} in, {formatKES(totals.profit)} profit
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
        {businesses.length === 0 && (
          <p className="rounded border bg-background p-4 text-sm text-muted-foreground">
            No businesses yet — set them up in{" "}
            <Link className="text-primary underline" href="/settings">
              Businesses & Shops
            </Link>
            .
          </p>
        )}
      </section>
    </div>
  );
}
