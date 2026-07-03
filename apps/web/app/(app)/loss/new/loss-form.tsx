"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Minus, Plus } from "lucide-react";
import type { Product, StockLevel, UnitLevel } from "@kibali/shared";
import { LOSS_REASONS } from "@kibali/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createLoss } from "@/app/actions/records";

export function LossForm({
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
  const [productId, setProductId] = useState("");
  const [unitLevel, setUnitLevel] = useState<UnitLevel>("piece");
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState<string>("Melted");
  const [otherReason, setOtherReason] = useState("");
  const [pending, startTransition] = useTransition();

  const product = products.find((p) => p.id === productId);
  const pieces = Number(stock.find((s) => s.product_id === productId)?.pieces_on_hand ?? 0);
  const availableInLevel = product
    ? unitLevel === "box"
      ? Math.floor(pieces / product.pieces_per_unit)
      : pieces
    : 0;

  function save() {
    if (!productId) return void toast.error("Choose the product.");
    const form = new FormData();
    form.set("location_id", locationId);
    form.set("product_id", productId);
    form.set("quantity", String(quantity));
    form.set("unit_level", unitLevel);
    form.set("reason", reason === "Other" ? otherReason || "Other" : reason);
    form.set("loss_date", new Date().toISOString().slice(0, 10));
    startTransition(async () => {
      const result = await createLoss(form);
      if (!result.ok) return void toast.error(result.error);
      toast.success("Recorded — stock updated.");
      router.push(`/home${window.location.search}`);
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
          <h1 className="text-xl font-bold">Spoiled / Lost Stock</h1>
          <p className="text-sm text-muted-foreground">{locationName}</p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="loss-product">Which product?</Label>
        <Select id="loss-product" value={productId} onChange={(e) => setProductId(e.target.value)}>
          <option value="">Choose a product…</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>

      {product && (
        <>
          <div>
            <Label className="mb-2 block">Whole boxes or single pieces?</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["box", "piece"] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setUnitLevel(level)}
                  className={`h-14 rounded border-2 font-semibold capitalize ${
                    unitLevel === level ? "border-primary bg-accent" : "border-border bg-background"
                  }`}
                >
                  {level === "box" ? `Whole ${product.unit_name}s` : `Single ${product.piece_name}s`}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {availableInLevel} {unitLevel === "box" ? product.unit_name : product.piece_name}s in stock
            </p>
          </div>

          <div>
            <Label className="mb-2 block">How many?</Label>
            <div className="flex items-center justify-center gap-3">
              <Button variant="outline" size="icon" aria-label="Less" onClick={() => setQuantity((q) => Math.max(1, q - 1))}>
                <Minus className="h-5 w-5" />
              </Button>
              <Input
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1))}
                inputMode="numeric"
                aria-label="Quantity"
                className="h-14 w-24 text-center text-2xl font-bold"
              />
              <Button variant="outline" size="icon" aria-label="More" onClick={() => setQuantity((q) => q + 1)}>
                <Plus className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <div>
            <Label className="mb-2 block">What happened?</Label>
            <div className="grid grid-cols-2 gap-2">
              {LOSS_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`h-12 rounded border-2 font-semibold ${
                    reason === r ? "border-primary bg-accent" : "border-border bg-background"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            {reason === "Other" && (
              <Input
                className="mt-2"
                placeholder="What happened?"
                value={otherReason}
                onChange={(e) => setOtherReason(e.target.value)}
              />
            )}
          </div>

          <Button size="xl" disabled={pending} onClick={save}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </>
      )}
    </div>
  );
}
