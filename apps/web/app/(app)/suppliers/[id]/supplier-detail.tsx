"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Banknote } from "lucide-react";
import type {
  DeliveryProgress,
  DeliverySummary,
  Supplier,
  SupplierBalance,
  SupplierPayment,
} from "@kibali/shared";
import { formatKES } from "@kibali/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { addSupplierPayment } from "@/app/actions/records";

function paymentBadge(d: DeliverySummary) {
  if (d.payment_status === "paid") return <Badge variant="good">Paid in full</Badge>;
  if (d.payment_status === "partially_paid")
    return (
      <Badge variant="warn">
        Paid {formatKES(d.amount_paid)} of {formatKES(d.total_cost)} — owes {formatKES(d.balance_owed)}
      </Badge>
    );
  return <Badge variant="bad">Not paid yet</Badge>;
}

export function SupplierDetail({
  supplier,
  balance,
  deliveries,
  progress,
  payments,
}: {
  supplier: Pick<Supplier, "id" | "name" | "phone" | "notes">;
  balance: SupplierBalance | null;
  deliveries: DeliverySummary[];
  progress: DeliveryProgress[];
  payments: SupplierPayment[];
}) {
  const router = useRouter();
  const [paying, setPaying] = useState(false);
  const [pending, startTransition] = useTransition();

  const progressOf = (deliveryId: string) => progress.find((p) => p.delivery_id === deliveryId);

  function submitPayment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    form.set("supplier_id", supplier.id);
    form.set("paid_on", new Date().toISOString().slice(0, 10));
    startTransition(async () => {
      const result = await addSupplierPayment(form);
      if (!result.ok) return void toast.error(result.error);
      toast.success("Payment recorded.");
      setPaying(false);
      router.refresh();
    });
  }

  const owed = balance?.balance_owed ?? 0;
  const unpaidDeliveries = deliveries.filter((d) => d.payment_status !== "paid");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button onClick={() => router.back()} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold">{supplier.name}</h1>
          {supplier.phone && <p className="text-sm text-muted-foreground">{supplier.phone}</p>}
        </div>
      </div>

      <Card className={owed > 0 ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40" : "bg-accent"}>
        <CardContent className="flex items-center justify-between p-4">
          <div>
            <div className="text-sm text-muted-foreground">Still owed to this supplier</div>
            <div className="text-2xl font-bold">{formatKES(owed)}</div>
          </div>
          <Button size="lg" onClick={() => setPaying(true)}>
            <Banknote className="h-5 w-5" /> Record a Payment
          </Button>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Deliveries</h2>
        {deliveries.length === 0 && (
          <p className="rounded border bg-background p-6 text-center text-muted-foreground">
            No deliveries from this supplier yet.
          </p>
        )}
        {deliveries.map((d) => {
          const batch = progressOf(d.delivery_id);
          const pct =
            batch && batch.total_pieces > 0
              ? Math.round(((batch.total_pieces - batch.pieces_remaining) / batch.total_pieces) * 100)
              : 0;
          return (
            <Card key={d.delivery_id}>
              <CardContent className="flex flex-col gap-2 p-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">
                    {new Date(d.delivery_date).toLocaleDateString("en-KE", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}{" "}
                    — {formatKES(d.total_cost)}
                  </div>
                  {batch?.status === "finished" ? (
                    <Badge variant="good">Finished ✓</Badge>
                  ) : (
                    <Badge variant="default">Selling — {pct}% sold</Badge>
                  )}
                </div>
                {batch && (
                  <div className="h-2 overflow-hidden rounded bg-muted">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                )}
                <div className="text-sm text-muted-foreground">
                  Hoped-for profit {formatKES(d.expected_profit)}
                  {batch && (
                    <>
                      {" · "}
                      {batch.status === "finished" ? (
                        <span className="font-semibold text-primary">
                          Profit made: {formatKES(batch.realized_profit)}
                        </span>
                      ) : (
                        <>profit so far {formatKES(batch.realized_profit)}</>
                      )}
                    </>
                  )}
                </div>
                <div>{paymentBadge(d)}</div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      {payments.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">Payments made</h2>
          {payments.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex items-center justify-between p-3 text-sm">
                <span>
                  {new Date(p.paid_on).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
                  {p.method ? ` · ${p.method}` : ""}
                </span>
                <span className="font-semibold">{formatKES(p.amount)}</span>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      <Modal open={paying} onClose={() => setPaying(false)} title={`Pay ${supplier.name}`}>
        <form onSubmit={submitPayment} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pay-amount">How much? (KSh)</Label>
            <Input id="pay-amount" name="amount" type="number" inputMode="decimal" min={1} step="0.01" className="h-14 text-2xl font-bold" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pay-delivery">For which delivery? (optional)</Label>
            <Select id="pay-delivery" name="delivery_id" defaultValue="">
              <option value="">The supplier account in general</option>
              {unpaidDeliveries.map((d) => (
                <option key={d.delivery_id} value={d.delivery_id}>
                  {new Date(d.delivery_date).toLocaleDateString("en-KE", { day: "numeric", month: "short" })} — owes {formatKES(d.balance_owed)}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pay-method">Paid by (optional)</Label>
            <Input id="pay-method" name="method" placeholder="cash / M-Pesa" />
          </div>
          <Button type="submit" size="lg" disabled={pending} loading={pending}>
            {pending ? "Saving…" : "Record Payment"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
