"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Home, Wallet, Zap, MoreHorizontal } from "lucide-react";
import type { ExpenseCategory } from "@kibali/shared";
import { EXPENSE_LABELS, formatKES } from "@kibali/shared";
import { BackdateField } from "@/components/backdate-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createExpense } from "@/app/actions/records";

const CATEGORIES = Object.keys(EXPENSE_LABELS) as ExpenseCategory[];
const CATEGORY_STYLE: Record<ExpenseCategory, { icon: typeof Home; tone: string }> = {
  rent: { icon: Home, tone: "from-indigo-500 to-violet-600" },
  salary: { icon: Wallet, tone: "from-emerald-500 to-teal-600" },
  electricity: { icon: Zap, tone: "from-amber-400 to-orange-500" },
  other: { icon: MoreHorizontal, tone: "from-slate-500 to-slate-700" },
};

export function ExpenseForm({
  locationId,
  locationName,
  monthlyRent,
  allowBackdate,
}: {
  locationId: string;
  locationName: string;
  monthlyRent: number | null;
  allowBackdate?: boolean;
}) {
  const router = useRouter();
  const [category, setCategory] = useState<ExpenseCategory>("other");
  const [amount, setAmount] = useState<string>("");
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));
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
    form.set("expense_date", expenseDate);
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
            {CATEGORIES.map((c) => {
              const { icon: Icon, tone } = CATEGORY_STYLE[c];
              const active = category === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => pick(c)}
                  className={`flex h-20 flex-col items-center justify-center gap-1 rounded text-sm font-semibold transition-transform active:scale-[0.98] ${
                    active
                      ? `bg-gradient-to-br ${tone} text-white shadow-md`
                      : "border-2 border-border bg-background text-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {EXPENSE_LABELS[c]}
                </button>
              );
            })}
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

        {allowBackdate && <BackdateField name="e-date" onChange={setExpenseDate} />}

        <Button type="submit" size="xl" disabled={pending} loading={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </form>
    </div>
  );
}
