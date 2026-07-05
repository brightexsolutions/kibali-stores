"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ChevronDown, Copy, HandCoins, Link2, Plus, RefreshCcw, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  Business,
  CapitalEntry,
  CapitalHistoryEntry,
  DistributionAllocation,
  InvestorSummary,
  ProfitDistribution,
} from "@kibali/shared";
import { formatKES } from "@kibali/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import {
  addCapital,
  createProfitDistribution,
  regenerateShareLink,
  saveInvestor,
  settleAllocation,
} from "@/app/actions/investors";

type ModalState =
  | { kind: "new-investor" }
  | { kind: "add-capital"; investorId?: string }
  | { kind: "distribute" }
  | null;

export interface ProfitContext {
  bankedByBusiness: Record<string, number>;
  bankedTotal: number;
  sharedByBusiness: Record<string, number>;
  sharedTotal: number;
}

export function InvestorsManager({
  summaries,
  history,
  entries,
  distributions,
  allocations,
  businesses,
  tokens,
  profitContext,
}: {
  summaries: InvestorSummary[];
  history: CapitalHistoryEntry[];
  entries: CapitalEntry[];
  distributions: ProfitDistribution[];
  allocations: DistributionAllocation[];
  businesses: Business[];
  tokens: Record<string, string>;
  profitContext: ProfitContext;
}) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalState>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [scope, setScope] = useState<string>("");
  const [totalProfit, setTotalProfit] = useState<string>("");
  const [amountOverrides, setAmountOverrides] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const businessName = (id: string | null) =>
    id ? businesses.find((b) => b.id === id)?.name ?? "one business" : "All businesses";

  // Scope rule: eligible capital = capital tagged to the chosen business + general capital.
  const eligible = useMemo(() => {
    const per = new Map<string, number>();
    for (const e of entries) {
      if (scope === "" || e.business_id === null || e.business_id === scope) {
        per.set(e.investor_id, (per.get(e.investor_id) ?? 0) + Number(e.amount));
      }
    }
    const total = [...per.values()].reduce((a, b) => a + b, 0);
    return { per, total };
  }, [entries, scope]);

  const profitNum = Number(totalProfit) || 0;
  const preview = summaries
    .filter((s) => (eligible.per.get(s.investor_id) ?? 0) > 0)
    .map((s) => {
      const capital = eligible.per.get(s.investor_id)!;
      const sharePct = eligible.total > 0 ? (capital / eligible.total) * 100 : 0;
      const suggested = Math.round(profitNum * (sharePct / 100) * 100) / 100;
      const amount =
        amountOverrides[s.investor_id] !== undefined
          ? Number(amountOverrides[s.investor_id]) || 0
          : suggested;
      return { investor: s, capital, sharePct, amount };
    });

  const pendingAllocations = allocations.filter((a) => a.status === "pending");
  const investorName = (id: string) => summaries.find((s) => s.investor_id === id)?.name ?? "—";
  const distributionOf = (id: string) => distributions.find((d) => d.id === id);

  function submitInvestor(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await saveInvestor(form);
      if (!result.ok) return void toast.error(result.error);
      toast.success("Investor added.");
      setModal(null);
      router.refresh();
    });
  }

  function submitCapital(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    form.set("entry_date", new Date().toISOString().slice(0, 10));
    startTransition(async () => {
      const result = await addCapital(form);
      if (!result.ok) return void toast.error(result.error);
      toast.success("Investment recorded.");
      setModal(null);
      router.refresh();
    });
  }

  function submitDistribution(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await createProfitDistribution({
        business_id: scope,
        period_label: String(form.get("period_label") ?? ""),
        total_profit: profitNum,
        distribution_date: new Date().toISOString().slice(0, 10),
        notes: "",
        allocations: preview.map((p) => ({
          investor_id: p.investor.investor_id,
          share_pct: Math.round(p.sharePct * 100) / 100,
          amount: p.amount,
        })),
      });
      if (!result.ok) return void toast.error(result.error);
      toast.success("Profit split saved — settle each share below.");
      setModal(null);
      setTotalProfit("");
      setAmountOverrides({});
      router.refresh();
    });
  }

  function settle(allocationId: string, decision: "disbursed" | "returned_to_business") {
    startTransition(async () => {
      const result = await settleAllocation({
        allocation_id: allocationId,
        decision,
        settled_on: new Date().toISOString().slice(0, 10),
      });
      if (!result.ok) return void toast.error(result.error);
      toast.success(
        decision === "disbursed" ? "Marked as sent to the investor." : "Returned to the business — capital updated."
      );
      router.refresh();
    });
  }

  async function copyLink(investorId: string) {
    const url = `${window.location.origin}/i/${tokens[investorId]}`;
    await navigator.clipboard.writeText(url);
    toast.success("Private summary link copied — share it with the investor.");
  }

  function newLink(investorId: string) {
    if (!confirm("Make a new link? The old one will stop working.")) return;
    startTransition(async () => {
      const result = await regenerateShareLink(investorId);
      if (!result.ok) return void toast.error(result.error);
      toast.success("New link ready — copy and share it.");
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
          <h1 className="text-2xl font-bold">Investors</h1>
          <p className="text-sm text-muted-foreground">
            Family money in the business and how profit is shared.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button size="lg" onClick={() => setModal({ kind: "distribute" })}>
          <HandCoins className="h-5 w-5" /> Distribute Profit
        </Button>
        <Button size="lg" variant="outline" onClick={() => setModal({ kind: "add-capital" })}>
          <Plus className="h-5 w-5" /> Add Investment
        </Button>
      </div>

      {pendingAllocations.length > 0 && (
        <Card className="border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40">
          <CardHeader>
            <CardTitle>Waiting for a decision</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {pendingAllocations.map((a) => {
              const d = distributionOf(a.distribution_id);
              return (
                <div key={a.id} className="flex flex-col gap-2 rounded border bg-background p-3">
                  <div className="text-sm">
                    <strong>{investorName(a.investor_id)}</strong> — {formatKES(a.amount)}{" "}
                    <span className="text-muted-foreground">
                      ({a.share_pct}% of {d?.period_label ?? "profit"})
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button size="sm" disabled={pending} loading={pending} onClick={() => settle(a.id, "disbursed")}>
                      <HandCoins className="h-4 w-4" /> Disburse
                    </Button>
                    <Button size="sm" variant="outline" disabled={pending} loading={pending} onClick={() => settle(a.id, "returned_to_business")}>
                      <Undo2 className="h-4 w-4" /> Return to business
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {summaries.length === 0 && (
        <p className="rounded border bg-background p-6 text-center text-muted-foreground">
          No investors yet — add the family members who put money in.
        </p>
      )}

      {summaries.map((s) => {
        const investorHistory = history.filter((h) => h.investor_id === s.investor_id);
        const expanded = expandedId === s.investor_id;
        return (
          <Card
            key={s.investor_id}
            className={cn(
              "transition-shadow",
              expanded && "border-primary ring-2 ring-primary/40 shadow-md"
            )}
          >
            {/* Collapsed = just the headline; tap anywhere on it to open. */}
            <button
              type="button"
              onClick={() => setExpandedId(expanded ? null : s.investor_id)}
              aria-expanded={expanded}
              className="flex w-full items-center justify-between gap-3 p-4 text-left"
            >
              <div className="min-w-0">
                <CardTitle>{s.name}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Capital {formatKES(s.capital)} · share {s.share_pct}%
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-2">
                <Badge variant="default">{s.share_pct}%</Badge>
                <span
                  className={cn(
                    "flex items-center gap-0.5 text-xs font-semibold text-primary",
                    expanded && "text-muted-foreground"
                  )}
                >
                  {expanded ? "Close" : "Details"}
                  <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
                </span>
              </span>
            </button>

            {expanded && (
              <CardContent className="flex flex-col gap-3 pt-0">
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  <div className="rounded border bg-background p-2">
                    <div className="text-xs text-muted-foreground">Received</div>
                    <div className="font-semibold">{formatKES(s.total_disbursed)}</div>
                  </div>
                  <div className="rounded border bg-background p-2">
                    <div className="text-xs text-muted-foreground">Returned</div>
                    <div className="font-semibold">{formatKES(s.total_returned)}</div>
                  </div>
                  <div className="rounded border bg-background p-2">
                    <div className="text-xs text-muted-foreground">Waiting</div>
                    <div className="font-semibold">{formatKES(s.pending_amount)}</div>
                  </div>
                </div>

                {investorHistory.length > 0 && (
                  <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                    {investorHistory.slice(0, 5).map((h) => (
                      <div key={h.entry_id} className="flex items-center justify-between rounded bg-muted/60 px-2 py-1.5">
                        <span>
                          {new Date(h.entry_date).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "2-digit" })}{" "}
                          — {h.entry_type === "investment" ? "invested" : "returned profit"}{" "}
                          {formatKES(h.amount)}
                        </span>
                        <span className="font-medium text-foreground">
                          capital {formatKES(h.running_capital)} → {h.share_pct_after}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                  <Button variant="outline" size="sm" onClick={() => setModal({ kind: "add-capital", investorId: s.investor_id })}>
                    <Plus className="h-4 w-4" /> Invest
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => copyLink(s.investor_id)}>
                    <Copy className="h-4 w-4" /> Copy link
                  </Button>
                  <Button variant="outline" size="sm" disabled={pending} loading={pending} onClick={() => newLink(s.investor_id)}>
                    <RefreshCcw className="h-4 w-4" /> New link
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}

      <Button variant="outline" onClick={() => setModal({ kind: "new-investor" })}>
        <Plus className="h-4 w-4" /> Add an investor
      </Button>

      {/* ---------- modals ---------- */}
      <Modal open={modal?.kind === "new-investor"} onClose={() => setModal(null)} title="New investor">
        <form onSubmit={submitInvestor} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="i-name">Name</Label>
            <Input id="i-name" name="name" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="i-phone">Phone (optional)</Label>
            <Input id="i-phone" name="phone" inputMode="tel" />
          </div>
          <Button type="submit" size="lg" disabled={pending} loading={pending}>
            {pending ? "Saving…" : "Save investor"}
          </Button>
        </form>
      </Modal>

      <Modal open={modal?.kind === "add-capital"} onClose={() => setModal(null)} title="Add an investment">
        {modal?.kind === "add-capital" && (
          <form onSubmit={submitCapital} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-investor">Who is investing?</Label>
              <Select id="c-investor" name="investor_id" defaultValue={modal.investorId ?? ""} required>
                <option value="">Choose…</option>
                {summaries.map((s) => (
                  <option key={s.investor_id} value={s.investor_id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-scope">Into which business?</Label>
              <Select id="c-scope" name="business_id" defaultValue="">
                <option value="">All businesses (Kibali as a whole)</option>
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} only
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-amount">How much? (KSh)</Label>
              <Input id="c-amount" name="amount" type="number" inputMode="decimal" min={1} step="0.01" className="h-14 text-2xl font-bold" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-notes">Note (optional)</Label>
              <Input id="c-notes" name="notes" />
            </div>
            <Button type="submit" size="lg" disabled={pending} loading={pending}>
              {pending ? "Saving…" : "Record investment"}
            </Button>
          </form>
        )}
      </Modal>

      <Modal open={modal?.kind === "distribute"} onClose={() => setModal(null)} title="Distribute profit">
        <form onSubmit={submitDistribution} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="d-scope">Profit from</Label>
            <Select id="d-scope" value={scope} onChange={(e) => { setScope(e.target.value); setAmountOverrides({}); }}>
              <option value="">All of Kibali Stores</option>
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} only
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="d-period">For which period?</Label>
            <Input id="d-period" name="period_label" placeholder="e.g. June 2026" required />
          </div>
          {(() => {
            const banked = scope
              ? profitContext.bankedByBusiness[scope] ?? 0
              : profitContext.bankedTotal;
            const shared = scope
              ? profitContext.sharedByBusiness[scope] ?? 0
              : profitContext.sharedTotal;
            const unshared = Math.max(0, Math.round((banked - shared) * 100) / 100);
            return (
              <div className="flex flex-col gap-1 rounded border bg-muted/50 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Profit banked ({businessName(scope || null)})</span>
                  <span className="font-semibold">{formatKES(banked)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Already shared out</span>
                  <span className="font-semibold">{formatKES(shared)}</span>
                </div>
                <div className="flex items-center justify-between gap-2 border-t pt-1.5">
                  <span className="font-medium">Not yet shared</span>
                  <span className="flex items-center gap-2">
                    <span className="font-bold">{formatKES(unshared)}</span>
                    {unshared > 0 && (
                      <Button type="button" size="sm" variant="outline" onClick={() => setTotalProfit(String(unshared))}>
                        Use this
                      </Button>
                    )}
                  </span>
                </div>
              </div>
            );
          })()}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="d-profit">Profit to share (KSh)</Label>
            <Input
              id="d-profit"
              type="number"
              inputMode="decimal"
              min={1}
              step="0.01"
              className="h-14 text-2xl font-bold"
              value={totalProfit}
              onChange={(e) => setTotalProfit(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Banked = profit from supplies that finished selling. You can share any amount.
            </p>
          </div>

          {profitNum > 0 && (
            <div className="flex flex-col gap-2">
              <Label>The split ({businessName(scope || null)})</Label>
              {preview.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No investors have capital in this scope yet.
                </p>
              )}
              {preview.map((p) => (
                <div key={p.investor.investor_id} className="flex items-center justify-between gap-2 rounded border bg-background p-2 text-sm">
                  <div>
                    <div className="font-medium">{p.investor.name}</div>
                    <div className="text-xs text-muted-foreground">
                      capital {formatKES(p.capital)} → {p.sharePct.toFixed(1)}%
                    </div>
                  </div>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    aria-label={`Amount for ${p.investor.name}`}
                    className="w-28 text-right"
                    value={amountOverrides[p.investor.investor_id] ?? p.amount}
                    onChange={(e) =>
                      setAmountOverrides((prev) => ({ ...prev, [p.investor.investor_id]: e.target.value }))
                    }
                  />
                </div>
              ))}
            </div>
          )}

          <Button type="submit" size="lg" disabled={pending || preview.length === 0 || profitNum <= 0}>
            {pending ? "Saving…" : "Confirm the split"}
          </Button>
        </form>
      </Modal>

      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <Link2 className="h-3.5 w-3.5" /> Each investor&apos;s link shows only their own money —
        no login needed.
      </p>
    </div>
  );
}
