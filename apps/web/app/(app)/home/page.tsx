import Link from "next/link";
import { Banknote, PackagePlus, Snowflake, TrendingUp, Wallet } from "lucide-react";
import type { DailyLocationSummary, ReorderStatus, StockLevel } from "@kibali/shared";
import { formatKES } from "@kibali/shared";
import { requireMember } from "@/lib/auth";
import { resolveLocation } from "@/lib/location";
import { createClient } from "@/lib/supabase/server";
import { greeting } from "@/lib/utils";
import { DayBrief } from "@/components/day-brief";
import { LocationPicker } from "@/components/location-picker";
import { StatCard } from "@/components/stat-card";

// Sale, Stock and Today already live in the bottom nav — these are the
// less-frequent actions that still deserve one tap from Home.
const QUICK_LINKS = [
  { href: "/expense/new", label: "Money Spent", icon: Banknote },
  { href: "/delivery/new", label: "Stock Arrived", icon: PackagePlus },
  { href: "/loss/new", label: "Spoiled / Lost", icon: Snowflake },
];

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ location?: string }>;
}) {
  const member = await requireMember();
  const { location: locationParam } = await searchParams;
  const { location, all } = await resolveLocation(member, locationParam);
  const firstName = member.fullName.split(" ")[0] || member.fullName;

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const yesterdayDate = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

  let todaySummary: DailyLocationSummary | null = null;
  let yesterdaySummary: DailyLocationSummary | null = null;
  let stock: StockLevel[] = [];
  let alerts: ReorderStatus[] = [];

  if (location) {
    const [todayRes, yesterdayRes, stockRes, reorderRes] = await Promise.all([
      supabase.from("v_daily_location_summary").select("*").eq("location_id", location.id).eq("day", today).maybeSingle(),
      supabase.from("v_daily_location_summary").select("*").eq("location_id", location.id).eq("day", yesterdayDate).maybeSingle(),
      supabase.from("v_stock_levels").select("*").eq("location_id", location.id),
      supabase.from("v_reorder_status").select("*").eq("location_id", location.id).eq("order_soon", true),
    ]);
    todaySummary = todayRes.data as DailyLocationSummary | null;
    yesterdaySummary = yesterdayRes.data as DailyLocationSummary | null;
    stock = (stockRes.data ?? []) as StockLevel[];
    alerts = (reorderRes.data ?? []) as ReorderStatus[];
  }

  const q = location && member.role !== "manager" ? `?location=${location.id}` : "";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">
          {greeting()}, {firstName} 👋
        </h1>
        <p className="text-sm text-muted-foreground">
          {location ? `${location.name} — ${location.business_name}` : "Choose a shop to begin."}
        </p>
      </div>

      {/* The header's environment switcher handles changing shops once one is
          chosen — only show the picker grid when there is nothing to show yet. */}
      {member.role !== "manager" && !location && <LocationPicker locations={all} />}

      {location && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <StatCard
              title="Sales today"
              value={formatKES(todaySummary?.sales_total ?? 0)}
              tone="info"
              icon={Wallet}
            />
            <StatCard
              title="Spent today"
              value={formatKES((todaySummary?.cash_expenses ?? 0) + (todaySummary?.loss_value ?? 0))}
              tone="warn"
              icon={Banknote}
            />
            <StatCard
              title="Profit today"
              value={formatKES(todaySummary?.actual_profit ?? 0)}
              tone="primary"
              icon={TrendingUp}
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            {QUICK_LINKS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={`${href}${q}`}
                className="flex h-24 flex-col items-center justify-center gap-1 rounded border bg-background text-xs font-semibold shadow-sm active:scale-[0.98]"
              >
                <Icon className="h-5 w-5 text-primary" />
                {label}
                <span className="text-[11px] font-bold text-primary">Record →</span>
              </Link>
            ))}
          </div>

          <DayBrief
            yesterday={yesterdaySummary}
            stockLineCount={stock.length}
            totalBoxes={stock.reduce((sum, s) => sum + Number(s.boxes_on_hand), 0)}
            alerts={alerts}
            locationQuery={q}
          />
        </>
      )}
    </div>
  );
}
