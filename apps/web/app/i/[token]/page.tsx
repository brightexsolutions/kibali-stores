import { notFound } from "next/navigation";
import type {
  CapitalHistoryEntry,
  DailyLocationSummary,
  DeliveryProgress,
  DistributionAllocation,
  InvestorSummary,
} from "@kibali/shared";
import { formatKES } from "@kibali/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { sixMonthsAgoISO, toMonthlyPoints, totalsFor, currentMonthKey, monthKey } from "@/lib/summaries";
import { AutoRefresh } from "@/components/auto-refresh";
import { MonthlyBars } from "@/components/charts/monthly-bars";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

/**
 * Private investor summary — public tokenized link, read-only, no login.
 * Served via the admin client AFTER token lookup; shows only this
 * investor's position plus the business in plain terms.
 */
export default async function InvestorLinkPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!/^[a-f0-9]{64}$/.test(token)) notFound();

  const admin = createAdminClient();
  const { data: investor } = await admin
    .from("investors")
    .select("id, name, is_active")
    .eq("share_link_token", token)
    .is("deleted_at", null)
    .maybeSingle();
  if (!investor || !investor.is_active) notFound();

  const [summaryRes, historyRes, allocationsRes, dailyRes, batchesRes] = await Promise.all([
    admin.from("v_investor_summary").select("*").eq("investor_id", investor.id).maybeSingle(),
    admin.from("v_capital_history").select("*").eq("investor_id", investor.id).order("entry_date"),
    admin
      .from("distribution_allocations")
      .select("*, profit_distributions(period_label, distribution_date)")
      .eq("investor_id", investor.id)
      .order("created_at", { ascending: false }),
    admin.from("v_daily_location_summary").select("*").gte("day", sixMonthsAgoISO()),
    admin.from("v_delivery_progress").select("*").eq("status", "finished"),
  ]);

  const summary = summaryRes.data as InvestorSummary | null;
  const history = (historyRes.data ?? []) as CapitalHistoryEntry[];
  const allocations = (allocationsRes.data ?? []) as (DistributionAllocation & {
    profit_distributions: { period_label: string; distribution_date: string } | null;
  })[];
  const daily = (dailyRes.data ?? []) as DailyLocationSummary[];
  const finished = (batchesRes.data ?? []) as DeliveryProgress[];

  const thisMonth = totalsFor(daily, (r) => monthKey(r.day) === currentMonthKey());
  const bankedProfit = finished.reduce((sum, b) => sum + Number(b.realized_profit), 0);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 pb-16">
      <AutoRefresh />
      <div>
        <p className="text-sm font-semibold text-primary">Kibali Stores</p>
        <h1 className="text-2xl font-bold">Hello {investor.name} 👋</h1>
        <p className="text-sm text-muted-foreground">
          Your private investment summary — only people with this link can see it.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <StatCard title="Your capital in the business" value={formatKES(summary?.capital ?? 0)} tone="primary" />
        <StatCard title="Your share today" value={`${summary?.share_pct ?? 0}%`} hint="of all family capital" />
        <StatCard title="Profit sent to you" value={formatKES(summary?.total_disbursed ?? 0)} />
        <StatCard title="Profit you returned" value={formatKES(summary?.total_returned ?? 0)} hint="added onto your capital" />
      </div>

      {Number(summary?.pending_amount ?? 0) > 0 && (
        <Card className="border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40">
          <CardContent className="p-4 text-sm">
            <strong>{formatKES(summary!.pending_amount)}</strong> of profit is waiting for your
            decision — tell the family whether to send it to you or return it to the business.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>How the business is doing</CardTitle>
          <CardDescription>
            This month: {formatKES(thisMonth.sales)} in sales · {formatKES(bankedProfit)} profit
            banked from finished supplies overall.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MonthlyBars data={toMonthlyPoints(daily)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your money, step by step</CardTitle>
          <CardDescription>
            Every investment and every profit you returned — and how it changed your share.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          {history.length === 0 && (
            <p className="text-sm text-muted-foreground">No capital recorded yet.</p>
          )}
          {history.map((h) => (
            <div key={h.entry_id} className="flex items-center justify-between rounded bg-muted/60 px-3 py-2 text-sm">
              <span>
                {new Date(h.entry_date).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}{" "}
                — {h.entry_type === "investment" ? "you invested" : "profit returned"}{" "}
                <strong>{formatKES(h.amount)}</strong>
              </span>
              <span className="text-xs text-muted-foreground">
                capital {formatKES(h.running_capital)} → {h.share_pct_after}%
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      {allocations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Your profit shares</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {allocations.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded bg-muted/60 px-3 py-2 text-sm">
                <span>
                  {a.profit_distributions?.period_label ?? "Profit share"} —{" "}
                  <strong>{formatKES(a.amount)}</strong>
                </span>
                {a.status === "pending" ? (
                  <Badge variant="warn">Waiting for you</Badge>
                ) : a.status === "disbursed" ? (
                  <Badge variant="good">
                    Sent {a.settled_on && new Date(a.settled_on).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}
                  </Badge>
                ) : (
                  <Badge>
                    Returned {a.settled_on && new Date(a.settled_on).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}
                  </Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Kibali Stores · figures update automatically as records are made.
      </p>
    </main>
  );
}
