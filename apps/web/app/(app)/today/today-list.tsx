"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Trash2 } from "lucide-react";
import type { DeliverySummary, ExpenseCategory, SaleSummary, UnitLevel } from "@kibali/shared";
import { EXPENSE_LABELS, formatKES } from "@kibali/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { softDeleteRecord } from "@/app/actions/records";

export interface TodayExpense {
  id: string;
  category: ExpenseCategory;
  amount: number;
  description: string | null;
  created_at: string;
}

export interface TodayLoss {
  id: string;
  quantity: number;
  unit_level: UnitLevel;
  reason: string;
  product_name: string;
  created_at: string;
}

function recordedAt(iso: string | undefined) {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString("en-KE", { hour: "numeric", minute: "2-digit" });
}

export function TodayList({
  locationName,
  sales,
  saleTimeById,
  expenses,
  losses,
  deliveries,
  deliveryTimeById,
}: {
  locationName: string;
  sales: SaleSummary[];
  saleTimeById: Record<string, string>;
  expenses: TodayExpense[];
  losses: TodayLoss[];
  deliveries: DeliverySummary[];
  deliveryTimeById: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function remove(table: string, id: string, what: string) {
    if (!confirm(`Remove this ${what}? This cannot be undone.`)) return;
    startTransition(async () => {
      const result = await softDeleteRecord(table, id);
      if (!result.ok) return void toast.error(result.error);
      toast.success("Removed.");
      router.refresh();
    });
  }

  const isEmpty =
    sales.length === 0 && expenses.length === 0 && losses.length === 0 && deliveries.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button onClick={() => router.back()} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold">Today&apos;s Records</h1>
          <p className="text-sm text-muted-foreground">{locationName}</p>
        </div>
      </div>

      {isEmpty && (
        <p className="rounded border bg-background p-6 text-center text-muted-foreground">
          Nothing recorded yet today — tap Record a Sale on the home screen when the first
          customer buys.
        </p>
      )}

      {sales.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">Sales</h2>
          {sales.map((s) => (
            <Card key={s.sale_id}>
              <CardContent className="flex items-center justify-between p-3">
                <div>
                  <div className="font-semibold">{formatKES(s.total_amount)}</div>
                  <div className="text-sm text-muted-foreground">
                    {s.sale_type === "wholesale" ? "Whole boxes" : "Single pieces"} · profit{" "}
                    {formatKES(s.profit)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {recordedAt(saleTimeById[s.sale_id]) && (
                    <span className="text-sm text-muted-foreground">{recordedAt(saleTimeById[s.sale_id])}</span>
                  )}
                  <Button variant="ghost" size="icon" aria-label="Remove sale" disabled={pending} onClick={() => remove("sales", s.sale_id, "sale")}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      {expenses.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">Money spent</h2>
          {expenses.map((e) => (
            <Card key={e.id}>
              <CardContent className="flex items-center justify-between p-3">
                <div>
                  <div className="font-semibold">{formatKES(e.amount)}</div>
                  <div className="text-sm text-muted-foreground">
                    {EXPENSE_LABELS[e.category]}
                    {e.description ? ` — ${e.description}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {recordedAt(e.created_at) && (
                    <span className="text-sm text-muted-foreground">{recordedAt(e.created_at)}</span>
                  )}
                  <Button variant="ghost" size="icon" aria-label="Remove expense" disabled={pending} onClick={() => remove("expenses", e.id, "expense")}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      {losses.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">Spoiled / lost</h2>
          {losses.map((l) => (
            <Card key={l.id}>
              <CardContent className="flex items-center justify-between p-3">
                <div>
                  <div className="font-semibold">
                    {l.quantity} {l.unit_level === "box" ? "box(es)" : "piece(s)"} — {l.product_name}
                  </div>
                  <div className="text-sm text-muted-foreground">{l.reason}</div>
                </div>
                <div className="flex items-center gap-2">
                  {recordedAt(l.created_at) && (
                    <span className="text-sm text-muted-foreground">{recordedAt(l.created_at)}</span>
                  )}
                  <Button variant="ghost" size="icon" aria-label="Remove loss" disabled={pending} onClick={() => remove("stock_losses", l.id, "loss")}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      {deliveries.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">Stock arrived</h2>
          {deliveries.map((d) => (
            <Card key={d.delivery_id}>
              <CardContent className="flex items-center justify-between p-3">
                <div>
                  <div className="font-semibold">{formatKES(d.total_cost)}</div>
                  <div className="text-sm text-muted-foreground">
                    {d.payment_status === "paid"
                      ? "Paid in full"
                      : d.payment_status === "partially_paid"
                        ? `Paid ${formatKES(d.amount_paid)} of ${formatKES(d.total_cost)} — still owed ${formatKES(d.balance_owed)}`
                        : "Not paid yet"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {recordedAt(deliveryTimeById[d.delivery_id]) && (
                    <span className="text-sm text-muted-foreground">
                      {recordedAt(deliveryTimeById[d.delivery_id])}
                    </span>
                  )}
                  <Button variant="ghost" size="icon" aria-label="Remove delivery" disabled={pending} onClick={() => remove("deliveries", d.delivery_id, "delivery")}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
