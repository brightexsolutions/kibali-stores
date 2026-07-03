import Link from "next/link";
import {
  Banknote,
  ClipboardList,
  PackagePlus,
  ShoppingCart,
  Snowflake,
} from "lucide-react";
import type { DailyLocationSummary, ReorderStatus, StockLevel } from "@kibali/shared";
import { formatKES } from "@kibali/shared";
import { requireMember } from "@/lib/auth";
import { resolveLocation } from "@/lib/location";
import { createClient } from "@/lib/supabase/server";
import { greeting } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { DayBrief } from "@/components/day-brief";
import { LocationPicker } from "@/components/location-picker";

const BIG_BUTTONS = [
  { href: "/sale/new", label: "Record a Sale", icon: ShoppingCart, tone: "bg-primary text-primary-foreground" },
  { href: "/expense/new", label: "Money Spent", icon: Banknote, tone: "bg-background" },
  { href: "/delivery/new", label: "Stock Arrived", icon: PackagePlus, tone: "bg-background" },
  { href: "/loss/new", label: "Spoiled / Lost", icon: Snowflake, tone: "bg-background" },
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

      {member.role !== "manager" && all.length > 1 && (
        <LocationPicker locations={all} selectedId={location?.id} />
      )}

      {location && (
        <>
          <Card>
            <CardContent className="grid grid-cols-3 gap-2 p-4 text-center">
              <div>
                <div className="text-xs text-muted-foreground">Sales today</div>
                <div className="text-lg font-bold">{formatKES(todaySummary?.sales_total ?? 0)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Spent today</div>
                <div className="text-lg font-bold">
                  {formatKES((todaySummary?.cash_expenses ?? 0) + (todaySummary?.loss_value ?? 0))}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Profit today</div>
                <div className="text-lg font-bold text-primary">
                  {formatKES(todaySummary?.actual_profit ?? 0)}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            {BIG_BUTTONS.map(({ href, label, icon: Icon, tone }) => (
              <Link
                key={href}
                href={`${href}${q}`}
                className={`flex h-[88px] flex-col items-center justify-center gap-1 rounded border text-base font-semibold shadow-sm active:scale-[0.99] ${tone}`}
              >
                <Icon className="h-6 w-6" />
                {label}
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

          <Link
            href={`/today${q}`}
            className="flex items-center justify-center gap-2 rounded border bg-background p-4 font-medium hover:bg-muted"
          >
            <ClipboardList className="h-5 w-5" /> Today&apos;s Records
          </Link>
        </>
      )}
    </div>
  );
}
