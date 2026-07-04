import Link from "next/link";
import { AlertTriangle, PackageSearch, Sun } from "lucide-react";
import type { DailyLocationSummary, ReorderStatus } from "@kibali/shared";
import { formatKES } from "@kibali/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * "How is the day starting?" — every role sees this first thing:
 * yesterday's sales, what stock is available, and whether a restock is due.
 */
export function DayBrief({
  yesterday,
  stockLineCount,
  totalBoxes,
  alerts,
  locationQuery,
}: {
  yesterday: Pick<DailyLocationSummary, "sales_total" | "actual_profit"> | null;
  stockLineCount: number;
  totalBoxes: number;
  alerts: ReorderStatus[];
  locationQuery?: string; // e.g. "?location=<id>" so links keep the shop
}) {
  const q = locationQuery ?? "";
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <Sun className="h-5 w-5 text-amber-500" />
        <CardTitle>How the day is starting</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded border bg-background p-3">
            <div className="text-muted-foreground">Yesterday&apos;s sales</div>
            <div className="text-lg font-bold">{formatKES(yesterday?.sales_total ?? 0)}</div>
            <div className="text-xs text-muted-foreground">
              profit {formatKES(yesterday?.actual_profit ?? 0)}
            </div>
          </div>
          <Link href={`/stock${q}`} className="rounded border bg-background p-3 hover:bg-muted">
            <div className="flex items-center gap-1 text-muted-foreground">
              <PackageSearch className="h-3.5 w-3.5" /> Stock available
            </div>
            <div className="text-lg font-bold">{totalBoxes} boxes</div>
            <div className="text-xs text-muted-foreground">
              across {stockLineCount} product{stockLineCount === 1 ? "" : "s"} — tap to see
            </div>
          </Link>
        </div>

        {alerts.length > 0 ? (
          <div className="flex flex-col gap-2">
            {alerts.map((a) => (
              <Link
                key={`${a.location_id}-${a.product_id}`}
                href={`/delivery/new${q}`}
                className="flex items-start gap-2 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/60"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>
                  <strong>{a.product_name}: order soon.</strong>{" "}
                  {a.boxes_on_hand} box{a.boxes_on_hand === 1 ? "" : "es"} left
                  {a.days_of_stock_left != null && <> — about {a.days_of_stock_left} days of stock</>}
                  {a.suggested_order_boxes != null && (
                    <>
                      . Last order was {a.last_order_boxes} boxes; consider ordering ~
                      {a.suggested_order_boxes} boxes.
                    </>
                  )}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Stock levels look fine — no restock needed yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
