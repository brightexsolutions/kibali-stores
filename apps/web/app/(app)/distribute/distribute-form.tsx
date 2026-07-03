"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Minus, Plus, Send } from "lucide-react";
import type { StockLevel } from "@kibali/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createDistribution } from "@/app/actions/records";

export function DistributeForm({
  locations,
  mainStock,
}: {
  locations: { id: string; name: string; business_id: string; business_name: string }[];
  mainStock: StockLevel[];
}) {
  const router = useRouter();
  const [locationId, setLocationId] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [pending, startTransition] = useTransition();

  const location = locations.find((l) => l.id === locationId);
  const stockForBusiness = location
    ? mainStock.filter((s) => s.business_id === location.business_id)
    : [];

  function setQty(s: StockLevel, qty: number) {
    const max = Number(s.boxes_on_hand);
    setQuantities((q) => ({ ...q, [s.product_id]: Math.min(Math.max(0, qty), max) }));
  }

  const items = stockForBusiness
    .filter((s) => (quantities[s.product_id] ?? 0) > 0)
    .map((s) => ({ product_id: s.product_id, quantity: quantities[s.product_id]! }));

  function send() {
    startTransition(async () => {
      const result = await createDistribution({
        location_id: locationId,
        distribution_date: new Date().toISOString().slice(0, 10),
        items,
      });
      if (!result.ok) return void toast.error(result.error);
      toast.success(`Stock sent to ${location?.name}.`);
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button onClick={() => router.back()} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold">Send Stock to a Shop</h1>
          <p className="text-sm text-muted-foreground">From the Main store</p>
        </div>
      </div>

      {mainStock.length === 0 ? (
        <p className="rounded border bg-background p-6 text-center text-muted-foreground">
          The Main store is empty. Record a delivery to “Main store” first, then send it to
          shops from here.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dist-loc">Which shop gets the stock?</Label>
            <Select id="dist-loc" value={locationId} onChange={(e) => { setLocationId(e.target.value); setQuantities({}); }}>
              <option value="">Choose a shop…</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} — {l.business_name}
                </option>
              ))}
            </Select>
          </div>

          {location && stockForBusiness.length === 0 && (
            <p className="rounded border bg-background p-6 text-center text-muted-foreground">
              The Main store has no stock for {location.business_name}.
            </p>
          )}

          {stockForBusiness.map((s) => {
            const qty = quantities[s.product_id] ?? 0;
            return (
              <Card key={s.product_id}>
                <CardContent className="flex items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{s.product_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.boxes_on_hand} {s.unit_name}(s) in the Main store
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" aria-label={`Less ${s.product_name}`} onClick={() => setQty(s, qty - 1)} disabled={qty === 0}>
                      <Minus className="h-5 w-5" />
                    </Button>
                    <input
                      value={qty}
                      onChange={(e) => setQty(s, Number(e.target.value.replace(/\D/g, "")) || 0)}
                      inputMode="numeric"
                      aria-label={`${s.product_name} boxes`}
                      className="h-11 w-14 rounded border text-center text-lg font-bold"
                    />
                    <Button variant="outline" size="icon" aria-label={`More ${s.product_name}`} onClick={() => setQty(s, qty + 1)}>
                      <Plus className="h-5 w-5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {location && (
            <Button size="xl" disabled={pending || items.length === 0} onClick={send}>
              <Send className="h-5 w-5" />
              {pending ? "Sending…" : `Send to ${location.name}`}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
