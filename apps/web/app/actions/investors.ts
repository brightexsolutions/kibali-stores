"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import {
  capitalEntrySchema,
  investorSchema,
  profitDistributionSchema,
  settleAllocationSchema,
  type ActionResult,
} from "@kibali/shared";
import { getSessionMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/audit";

async function requireOwnerAction() {
  const member = await getSessionMember();
  if (!member || member.role === "manager") return null;
  return member;
}

function firstIssue(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Check the form and try again.";
}

export async function saveInvestor(formData: FormData, id?: string): Promise<ActionResult> {
  const member = await requireOwnerAction();
  if (!member) return { ok: false, error: "Only owners can manage investors." };

  const parsed = investorSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const values = {
    name: parsed.data.name,
    phone: parsed.data.phone || null,
    notes: parsed.data.notes || null,
  };
  const { data, error } = id
    ? await supabase.from("investors").update(values).eq("id", id).select("id").single()
    : await supabase.from("investors").insert(values).select("id").single();
  if (error) {
    console.error("[investors.saveInvestor]", error.message);
    return { ok: false, error: "Could not save the investor. Try again." };
  }

  await logAction(supabase, member.userId, id ? "investor.updated" : "investor.created", "investor", data.id, values);
  revalidatePath("/investors");
  return { ok: true };
}

export async function addCapital(formData: FormData): Promise<ActionResult> {
  const member = await requireOwnerAction();
  if (!member) return { ok: false, error: "Only owners can manage investors." };

  const parsed = capitalEntrySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("capital_entries")
    .insert({
      investor_id: parsed.data.investor_id,
      business_id: parsed.data.business_id || null,
      amount: parsed.data.amount,
      entry_type: "investment",
      entry_date: parsed.data.entry_date,
      notes: parsed.data.notes || null,
      created_by: member.userId,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[investors.addCapital]", error.message);
    return { ok: false, error: "Could not record the investment. Try again." };
  }

  await logAction(supabase, member.userId, "capital.invested", "capital_entry", data.id, {
    investor_id: parsed.data.investor_id,
    amount: parsed.data.amount,
    business_id: parsed.data.business_id || null,
  });
  revalidatePath("/investors");
  return { ok: true };
}

/** Confirm a distribution: writes the distribution + PENDING allocations. */
export async function createProfitDistribution(payload: unknown): Promise<ActionResult> {
  const member = await requireOwnerAction();
  if (!member) return { ok: false, error: "Only owners can distribute profit." };

  const parsed = profitDistributionSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const input = parsed.data;

  const allocated = input.allocations.reduce((sum, a) => sum + a.amount, 0);
  if (allocated - input.total_profit > 0.01) {
    return { ok: false, error: "The shares add up to more than the profit being distributed." };
  }

  const supabase = await createClient();
  const { data: distribution, error: distError } = await supabase
    .from("profit_distributions")
    .insert({
      business_id: input.business_id || null,
      period_label: input.period_label,
      total_profit: input.total_profit,
      distribution_date: input.distribution_date,
      status: "confirmed",
      notes: input.notes || null,
      created_by: member.userId,
    })
    .select("id")
    .single();
  if (distError) {
    console.error("[investors.createProfitDistribution]", distError.message);
    return { ok: false, error: "Could not save the distribution. Try again." };
  }

  const { error: allocError } = await supabase.from("distribution_allocations").insert(
    input.allocations.map((a) => ({
      distribution_id: distribution.id,
      investor_id: a.investor_id,
      share_pct: a.share_pct,
      amount: a.amount,
      status: "pending",
    }))
  );
  if (allocError) {
    console.error("[investors.createProfitDistribution] alloc", allocError.message);
    await supabase.from("profit_distributions").update({ deleted_at: new Date().toISOString() }).eq("id", distribution.id);
    return { ok: false, error: "Could not save the shares. Try again." };
  }

  await logAction(supabase, member.userId, "distribution.confirmed", "profit_distribution", distribution.id, {
    period: input.period_label,
    total_profit: input.total_profit,
    investors: input.allocations.length,
  });
  revalidatePath("/investors");
  return { ok: true };
}

/**
 * Dated settle action per investor: Disburse (money sent to them) or
 * Return to business (adds to their capital, growing their future share).
 */
export async function settleAllocation(payload: unknown): Promise<ActionResult> {
  const member = await requireOwnerAction();
  if (!member) return { ok: false, error: "Only owners can settle shares." };

  const parsed = settleAllocationSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const input = parsed.data;

  const supabase = await createClient();
  const { data: allocation, error: loadError } = await supabase
    .from("distribution_allocations")
    .select("id, investor_id, amount, status, profit_distributions(business_id, period_label)")
    .eq("id", input.allocation_id)
    .single();
  if (loadError || !allocation) {
    return { ok: false, error: "Could not find that share." };
  }
  if (allocation.status !== "pending") {
    return { ok: false, error: "This share is already settled." };
  }

  const { error: updateError } = await supabase
    .from("distribution_allocations")
    .update({ status: input.decision, settled_on: input.settled_on })
    .eq("id", input.allocation_id)
    .eq("status", "pending");
  if (updateError) {
    console.error("[investors.settleAllocation]", updateError.message);
    return { ok: false, error: "Could not settle the share. Try again." };
  }

  if (input.decision === "returned_to_business") {
    const distribution = allocation.profit_distributions as unknown as {
      business_id: string | null;
      period_label: string;
    };
    const { error: capitalError } = await supabase.from("capital_entries").insert({
      investor_id: allocation.investor_id,
      business_id: distribution?.business_id ?? null,
      amount: allocation.amount,
      entry_type: "reinvested_profit",
      entry_date: input.settled_on,
      notes: `Returned to business — ${distribution?.period_label ?? "profit share"}`,
      created_by: member.userId,
    });
    if (capitalError) {
      // undo the settle so the money is never in limbo
      console.error("[investors.settleAllocation] capital", capitalError.message);
      await supabase
        .from("distribution_allocations")
        .update({ status: "pending", settled_on: null })
        .eq("id", input.allocation_id);
      return { ok: false, error: "Could not add it back to capital. Nothing was changed." };
    }
  }

  await logAction(
    supabase,
    member.userId,
    input.decision === "disbursed" ? "allocation.disbursed" : "allocation.returned_to_business",
    "distribution_allocation",
    input.allocation_id,
    { amount: allocation.amount, settled_on: input.settled_on }
  );
  revalidatePath("/investors");
  return { ok: true };
}

export async function regenerateShareLink(investorId: string): Promise<ActionResult> {
  const member = await requireOwnerAction();
  if (!member) return { ok: false, error: "Only owners can manage investors." };

  const supabase = await createClient();
  const token = randomBytes(32).toString("hex");
  const { error } = await supabase
    .from("investors")
    .update({ share_link_token: token })
    .eq("id", investorId);
  if (error) {
    console.error("[investors.regenerateShareLink]", error.message);
    return { ok: false, error: "Could not make a new link." };
  }

  await logAction(supabase, member.userId, "investor.link_regenerated", "investor", investorId);
  revalidatePath("/investors");
  return { ok: true };
}
