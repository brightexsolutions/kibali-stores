"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import type { Product, Supplier } from "@kibali/shared";
import { formatKES } from "@kibali/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createDelivery } from "@/app/actions/records";

interface Line {
  product_id: string;
  quantity: string;
  unit_cost: string;
  unit_wholesale_price: string;
}

export function DeliveryForm({
  isOwner,
  locations,
  defaultLocationId,
  suppliers,
  products,
}: {
  isOwner: boolean;
  locations: { id: string; name: string; business_name: string }[];
  defaultLocationId: string;
  suppliers: Supplier[];
  products: Product[];
}) {
  const router = useRouter();
  const [supplierId, setSupplierId] = useState("");
  const [locationId, setLocationId] = useState(defaultLocationId);
  const [lines, setLines] = useState<Line[]>([]);
  const [totalOverride, setTotalOverride] = useState<string>("");
  const [paidNow, setPaidNow] = useState<string>("");
  const [method, setMethod] = useState<string>("");
  const [pending, startTransition] = useTransition();

  const supplier = suppliers.find((s) => s.id === supplierId);
  const supplierProducts = useMemo(
    () => (supplier ? products.filter((p) => p.business_id === supplier.business_id) : []),
    [supplier, products]
  );

  const itemsTotal = lines.reduce(
    (sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unit_cost) || 0),
    0
  );
  const totalCost = totalOverride !== "" ? Number(totalOverride) || 0 : itemsTotal;
  const stillOwed = Math.max(0, totalCost - (Number(paidNow) || 0));

  function addLine() {
    setLines((ls) => [...ls, { product_id: "", quantity: "", unit_cost: "", unit_wholesale_price: "" }]);
  }

  function setLine(index: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function pickProduct(index: number, productId: string) {
    const p = products.find((x) => x.id === productId);
    setLine(index, {
      product_id: productId,
      unit_cost: p ? String(p.cost_price) : "",
      unit_wholesale_price: p ? String(p.wholesale_price) : "",
    });
  }

  function save() {
    if (!supplierId) return void toast.error("Choose the supplier.");
    if (lines.length === 0) return void toast.error("Add what was delivered.");
    startTransition(async () => {
      const result = await createDelivery({
        supplier_id: supplierId,
        location_id: locationId, // "" = Main store
        delivery_date: new Date().toISOString().slice(0, 10),
        total_cost: totalCost,
        paid_now: Number(paidNow) || 0,
        payment_method: method,
        notes: "",
        items: lines.map((l) => ({
          product_id: l.product_id,
          quantity: Number(l.quantity) || 0,
          unit_cost: Number(l.unit_cost) || 0,
          unit_wholesale_price: Number(l.unit_wholesale_price) || 0,
        })),
      });
      if (!result.ok) return void toast.error(result.error);
      toast.success(
        stillOwed > 0
          ? `Delivery saved. Still owed to supplier: ${formatKES(stillOwed)}.`
          : "Delivery saved and fully paid."
      );
      router.push("/home");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button onClick={() => router.back()} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold">Stock Arrived</h1>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="d-supplier">Who supplied it?</Label>
        <Select id="d-supplier" value={supplierId} onChange={(e) => { setSupplierId(e.target.value); setLines([]); }}>
          <option value="">Choose the supplier…</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </div>

      {isOwner && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="d-where">Where did the stock go?</Label>
          <Select id="d-where" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            <option value="">Main store — I will send it to shops later</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} — {l.business_name}
              </option>
            ))}
          </Select>
        </div>
      )}

      {supplierId && (
        <>
          <div className="flex flex-col gap-2">
            <Label>What was delivered?</Label>
            {lines.map((line, i) => {
              const p = products.find((x) => x.id === line.product_id);
              return (
                <Card key={i}>
                  <CardContent className="flex flex-col gap-2 p-3">
                    <div className="flex items-center gap-2">
                      <Select
                        aria-label="Product"
                        value={line.product_id}
                        onChange={(e) => pickProduct(i, e.target.value)}
                        className="flex-1"
                      >
                        <option value="">Choose a product…</option>
                        {supplierProducts.map((sp) => (
                          <option key={sp.id} value={sp.id}>
                            {sp.name}
                          </option>
                        ))}
                      </Select>
                      <Button variant="ghost" size="icon" aria-label="Remove line" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {line.product_id && (
                      <div className="grid grid-cols-3 gap-2">
                        <div className="flex flex-col gap-1">
                          <Label className="text-xs">How many {p?.unit_name ?? "box"}es?</Label>
                          <Input type="number" inputMode="numeric" min={1} value={line.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} />
                        </div>
                        <div className="flex flex-col gap-1">
                          <Label className="text-xs">Cost per {p?.unit_name ?? "box"} this time</Label>
                          <Input type="number" inputMode="decimal" min={0} step="0.01" value={line.unit_cost} onChange={(e) => setLine(i, { unit_cost: e.target.value })} />
                        </div>
                        <div className="flex flex-col gap-1">
                          <Label className="text-xs">Will sell per {p?.unit_name ?? "box"} at</Label>
                          <Input type="number" inputMode="decimal" min={0} step="0.01" value={line.unit_wholesale_price} onChange={(e) => setLine(i, { unit_wholesale_price: e.target.value })} />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
            <Button variant="outline" onClick={addLine}>
              <Plus className="h-4 w-4" /> Add a product
            </Button>
          </div>

          <Card className="bg-accent">
            <CardContent className="flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="d-total">Total the supplier charged</Label>
                <Input
                  id="d-total"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  className="w-32 text-right font-bold"
                  value={totalOverride !== "" ? totalOverride : itemsTotal || ""}
                  onChange={(e) => setTotalOverride(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="d-paid">How much was paid now?</Label>
                <Input
                  id="d-paid"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  className="w-32 text-right"
                  value={paidNow}
                  onChange={(e) => setPaidNow(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="d-method">Paid by (optional)</Label>
                <Input id="d-method" placeholder="cash / M-Pesa" className="w-32 text-right" value={method} onChange={(e) => setMethod(e.target.value)} />
              </div>
              <div className="flex items-center justify-between border-t pt-3 text-sm font-semibold">
                <span>Still owed to supplier</span>
                <span className={stillOwed > 0 ? "text-amber-700" : "text-primary"}>
                  {formatKES(stillOwed)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Button size="xl" disabled={pending} loading={pending} onClick={save}>
            {pending ? "Saving…" : "Save Delivery"}
          </Button>
        </>
      )}
    </div>
  );
}
