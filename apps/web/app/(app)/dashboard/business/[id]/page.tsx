import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight, Store } from "lucide-react";
import type { DailyLocationSummary, DeliveryProgress } from "@kibali/shared";
import { formatKES } from "@kibali/shared";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { currentMonthKey, monthKey, sixMonthsAgoISO, toMonthlyPoints, totalsFor } from "@/lib/summaries";
import { MonthlyBars } from "@/components/charts/monthly-bars";
import { BatchStrip } from "@/components/batch-strip";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function BusinessDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOwner();
  const { id } = await params;
  const supabase = await createClient();

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, description")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!business) notFound();

  const [locationsRes, suppliersRes, membersRes] = await Promise.all([
    supabase.from("locations").select("id, name").eq("business_id", id).is("deleted_at", null).order("name"),
    supabase.from("suppliers").select("id, name").eq("business_id", id).is("deleted_at", null),
    supabase.from("members").select("location_id, is_active, profiles(full_name)").eq("role", "manager").eq("is_active", true),
  ]);
  const locations = locationsRes.data ?? [];
  const locationIds = locations.map((l) => l.id);
  const supplierIds = (suppliersRes.data ?? []).map((s) => s.id);

  const [dailyRes, batchesRes] = await Promise.all([
    locationIds.length
      ? supabase.from("v_daily_location_summary").select("*").in("location_id", locationIds).gte("day", sixMonthsAgoISO())
      : Promise.resolve({ data: [] }),
    supplierIds.length
      ? supabase.from("v_delivery_progress").select("*").in("supplier_id", supplierIds).order("delivery_date", { ascending: false }).limit(12)
      : Promise.resolve({ data: [] }),
  ]);

  const daily = (dailyRes.data ?? []) as DailyLocationSummary[];
  const batches = (batchesRes.data ?? []) as DeliveryProgress[];
  const thisMonth = totalsFor(daily, (r) => monthKey(r.day) === currentMonthKey());
  const supplierNames = new Map((suppliersRes.data ?? []).map((s) => [s.id, s.name] as const));
  const managerOf = (locationId: string) =>
    (membersRes.data ?? []).find((m) => m.location_id === locationId)?.profiles as unknown as
      | { full_name: string }
      | undefined;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Link href="/dashboard" aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{business.name}</h1>
          {business.description && (
            <p className="text-sm text-muted-foreground">{business.description}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <StatCard title="Money in (month)" value={formatKES(thisMonth.sales)} />
        <StatCard title="Spent (month)" value={formatKES(thisMonth.spent)} />
        <StatCard title="Profit (month)" value={formatKES(thisMonth.profit)} tone="primary" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Last 6 months</CardTitle>
          <CardDescription>This business only.</CardDescription>
        </CardHeader>
        <CardContent>
          <MonthlyBars data={toMonthlyPoints(daily)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stock batches</CardTitle>
          <CardDescription>Supplies for this business and what each earned.</CardDescription>
        </CardHeader>
        <CardContent>
          <BatchStrip batches={batches} supplierNames={supplierNames} />
        </CardContent>
      </Card>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Shops</h2>
        {locations.map((l) => {
          const totals = totalsFor(
            daily,
            (r) => r.location_id === l.id && monthKey(r.day) === currentMonthKey()
          );
          const manager = managerOf(l.id);
          return (
            <Link key={l.id} href={`/dashboard/location/${l.id}`}>
              <Card className="hover:bg-muted/50">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <Store className="h-5 w-5 text-primary" />
                    <div>
                      <div className="font-semibold">{l.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {manager ? `Run by ${manager.full_name}` : "No manager assigned"} · this
                        month: {formatKES(totals.sales)} in, {formatKES(totals.profit)} profit
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
