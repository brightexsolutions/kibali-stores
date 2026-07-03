"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Box, Minus, PackageOpen, Plus, Tag } from "lucide-react";
import type { Product, SaleType, StockLevel } from "@kibali/shared";
import { formatKES } from "@kibali/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createSale } from "@/app/actions/records";

type Step = "mode" | "items" | "confirm";

export function SaleWizard({
  locationId,
  locationName,
  products,
  stock,
}: {
  locationId: string;
  locationName: string;
  products: Product[];
  stock: StockLevel[];
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("mode");
  const [mode, setMode] = useState<SaleType>("wholesale");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [pending, startTransition] = useTransition();

  const isBox = mode === "wholesale";

  const available = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of stock) map.set(s.product_id, Number(s.pieces_on_hand));
    return map;
  }, [stock]);

  function availableInMode(p: Product) {
    const pieces = available.get(p.id) ?? 0;
    return isBox ? Math.floor(pieces / p.pieces_per_unit) : pieces;
  }

  function defaultPrice(p: Product) {
    return isBox ? Number(p.wholesale_price) : Number(p.retail_price_per_piece);
  }

  function setQty(p: Product, qty: number) {
    const capped = Math.max(0, qty);
    setQuantities((q) => ({ ...q, [p.id]: capped }));
    if (capped > availableInMode(p)) {
      toast.warning(`Only ${availableInMode(p)} ${isBox ? p.unit_name : p.piece_name}s of ${p.name} in stock.`);
    }
  }

  const lines = products
    .filter((p) => (quantities[p.id] ?? 0) > 0)
    .map((p) => {
      const quantity = quantities[p.id]!;
      const unitPrice = prices[p.id] ?? defaultPrice(p);
      return { product: p, quantity, unitPrice, total: quantity * unitPrice };
    });
  const grandTotal = lines.reduce((sum, l) => sum + l.total, 0);

  function save() {
    startTransition(async () => {
      const result = await createSale({
        location_id: locationId,
        sale_date: new Date().toISOString().slice(0, 10),
        sale_type: mode,
        customer_name: "",
        items: lines.map((l) => ({
          product_id: l.product.id,
          quantity: l.quantity,
          unit_level: isBox ? "box" : "piece",
          unit_price: l.unitPrice,
        })),
      });
      if (!result.ok) return void toast.error(result.error);
      toast.success(`Sale saved — ${formatKES(grandTotal)}.`);
      router.push(`/home${window.location.search}`);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => (step === "mode" ? router.back() : setStep(step === "confirm" ? "items" : "mode"))}
          aria-label="Back"
          className="flex h-11 w-11 items-center justify-center rounded hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold">Record a Sale</h1>
          <p className="text-sm text-muted-foreground">{locationName}</p>
        </div>
      </div>

      {step === "mode" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">How is this sale?</p>
          {(
            [
              { value: "wholesale", title: "Whole boxes", sub: "Wholesale — selling full boxes", icon: Box, tone: "from-emerald-500 to-teal-600" },
              { value: "retail", title: "Single pieces", sub: "Retail — one ice pop, one packet…", icon: PackageOpen, tone: "from-sky-500 to-blue-600" },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              onClick={() => {
                setMode(option.value);
                setQuantities({});
                setPrices({});
                setStep("items");
              }}
              className="flex items-center gap-4 rounded border-2 border-border bg-background p-5 text-left active:scale-[0.99]"
            >
              <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${option.tone} text-white`}>
                <option.icon className="h-7 w-7" />
              </span>
              <div>
                <div className="text-lg font-bold">{option.title}</div>
                <div className="text-sm text-muted-foreground">{option.sub}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {step === "items" && (
        <>
          <p className="text-sm text-muted-foreground">
            Tap + for each {isBox ? "box" : "piece"} sold.
          </p>
          <div className="flex flex-col gap-2">
            {products.map((p) => {
              const qty = quantities[p.id] ?? 0;
              const have = availableInMode(p);
              const over = qty > have;
              return (
                <Card key={p.id} className={over ? "border-red-400" : ""}>
                  <CardContent className="flex items-center justify-between gap-2 p-3">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatKES(defaultPrice(p))} per {isBox ? p.unit_name : p.piece_name} ·{" "}
                        <span className={have === 0 ? "text-red-600 font-semibold" : ""}>
                          {have} left
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="icon" aria-label={`Less ${p.name}`} onClick={() => setQty(p, qty - 1)} disabled={qty === 0}>
                        <Minus className="h-5 w-5" />
                      </Button>
                      <input
                        value={qty}
                        onChange={(e) => setQty(p, Number(e.target.value.replace(/\D/g, "")) || 0)}
                        inputMode="numeric"
                        aria-label={`${p.name} quantity`}
                        className="h-11 w-14 rounded border text-center text-lg font-bold"
                      />
                      <Button variant="outline" size="icon" aria-label={`More ${p.name}`} onClick={() => setQty(p, qty + 1)}>
                        <Plus className="h-5 w-5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <Button size="xl" disabled={lines.length === 0} onClick={() => setStep("confirm")}>
            Continue — {formatKES(grandTotal)}
          </Button>
        </>
      )}

      {step === "confirm" && (
        <>
          <p className="text-sm text-muted-foreground">
            {isBox
              ? "Check everything. Buying many boxes, or bargained? Give a better price below."
              : "Check everything, change a price if you agreed a different one."}
          </p>
          <div className="flex flex-col gap-2">
            {lines.map((l) => {
              const list = defaultPrice(l.product);
              const bargained = l.unitPrice < list;
              return (
                <Card key={l.product.id} className={bargained ? "border-amber-300" : ""}>
                  <CardContent className="flex flex-col gap-2 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold">
                          {l.quantity} × {l.product.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {isBox ? l.product.unit_name : l.product.piece_name}s @{" "}
                          {formatKES(l.unitPrice)} = <strong>{formatKES(l.total)}</strong>
                        </div>
                      </div>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.01"
                        aria-label={`Price for ${l.product.name}`}
                        className="w-24 text-right"
                        value={l.unitPrice}
                        onChange={(e) =>
                          setPrices((prev) => ({ ...prev, [l.product.id]: Number(e.target.value) || 0 }))
                        }
                      />
                    </div>
                    {isBox && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">Quick price:</span>
                        {[0, 5, 10, 20].map((cut) => {
                          const candidate = list - cut;
                          const active = l.unitPrice === candidate;
                          return (
                            <button
                              key={cut}
                              type="button"
                              onClick={() =>
                                setPrices((prev) => ({ ...prev, [l.product.id]: candidate }))
                              }
                              className={`rounded px-2 py-1 text-xs font-semibold ${
                                active
                                  ? "bg-amber-500 text-white"
                                  : "bg-muted text-muted-foreground hover:bg-muted/70"
                              }`}
                            >
                              {cut === 0 ? "Full price" : `-${cut}`}
                            </button>
                          );
                        })}
                        {bargained && (
                          <Badge variant="warn" className="ml-auto gap-1">
                            <Tag className="h-3 w-3" /> Bargained (full price {formatKES(list)})
                          </Badge>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md">
            <CardContent className="flex items-center justify-between p-4">
              <span className="font-semibold">Total</span>
              <span className="text-2xl font-bold">{formatKES(grandTotal)}</span>
            </CardContent>
          </Card>
          <Button size="xl" loading={pending} onClick={save}>
            {pending ? "Saving…" : "Save Sale"}
          </Button>
        </>
      )}
    </div>
  );
}
