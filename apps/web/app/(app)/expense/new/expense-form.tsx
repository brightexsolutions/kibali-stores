"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import type { ExpenseCategory } from "@kibali/shared";
import { EXPENSE_LABELS, formatKES } from "@kibali/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createExpense } from "@/app/actions/records";

const CATEGORIES = Object.keys(EXPENSE_LABELS) as ExpenseCategory[];

export function ExpenseForm({
  locationId,
  locationName,
  monthlyRent,
}: {
  locationId: string;
  locationName: string;
  monthlyRent: number | null;
}) {
  const router = useRouter();
  const [category, setCategory] = useState<ExpenseCategory>("other");
  const [amount, setAmount] = useState<string>("");
  const [pending, startTransition] = useTransition();

  function pick(c: ExpenseCategory) {
    setCategory(c);
    if (c === "rent" && monthlyRent && !amount) setAmount(String(monthlyRent));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    form.set("location_id", locationId);
    form.set("category", category);
    form.set("expense_date", new Date().toISOString().slice(0, 10));
    startTransition(async () => {
      const result = await createExpense(form);
      if (!result.ok) return void toast.error(result.error);
      toast.success(`Saved — ${EXPENSE_LABELS[category]} ${formatKES(Number(form.get("amount")))}.`);
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
          <h1 className="text-xl font-bold">Money Spent</h1>
          <p className="text-sm text-muted-foreground">{locationName}</p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div>
          <Label className="mb-2 block">What was it for?</Label>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => pick(c)}
                className={`h-14 rounded border-2 text-base font-semibold ${
                  category === c ? "border-primary bg-accent" : "border-border bg-background"
                }`}
              >
                {EXPENSE_LABELS[c]}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Spoiled stock? Use <strong>Spoiled / Lost</strong> on the home screen instead.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="e-amount">How much? (KSh)</Label>
          <Input
            id="e-amount"
            name="amount"
            type="number"
            inputMode="decimal"
            min={1}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-14 text-2xl font-bold"
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="e-desc">Note (optional)</Label>
          <Input id="e-desc" name="description" placeholder="e.g. June rent" />
        </div>

        <Button type="submit" size="xl" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </form>
    </div>
  );
}
