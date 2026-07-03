import type {
  Business,
  CapitalEntry,
  CapitalHistoryEntry,
  DistributionAllocation,
  InvestorSummary,
  ProfitDistribution,
} from "@kibali/shared";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { InvestorsManager } from "./investors-manager";

export default async function InvestorsPage() {
  await requireOwner();
  const supabase = await createClient();

  const [summaries, history, entries, distributions, allocations, businesses, investors] =
    await Promise.all([
      supabase.from("v_investor_summary").select("*").order("capital", { ascending: false }),
      supabase.from("v_capital_history").select("*").order("entry_date", { ascending: false }).limit(50),
      supabase.from("capital_entries").select("id, investor_id, business_id, amount, entry_type, entry_date, notes").is("deleted_at", null),
      supabase.from("profit_distributions").select("*").is("deleted_at", null).order("distribution_date", { ascending: false }).limit(10),
      supabase.from("distribution_allocations").select("*").order("created_at", { ascending: false }),
      supabase.from("businesses").select("id, name").is("deleted_at", null).order("name"),
      supabase.from("investors").select("id, name, share_link_token").is("deleted_at", null),
    ]);

  const tokens = new Map(
    (investors.data ?? []).map((i) => [i.id, i.share_link_token] as const)
  );

  return (
    <InvestorsManager
      summaries={(summaries.data ?? []) as InvestorSummary[]}
      history={(history.data ?? []) as CapitalHistoryEntry[]}
      entries={(entries.data ?? []) as CapitalEntry[]}
      distributions={(distributions.data ?? []) as ProfitDistribution[]}
      allocations={(allocations.data ?? []) as DistributionAllocation[]}
      businesses={(businesses.data ?? []) as Business[]}
      tokens={Object.fromEntries(tokens)}
    />
  );
}
