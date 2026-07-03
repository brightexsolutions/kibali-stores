import { redirect } from "next/navigation";
import type { DeliverySummary, SaleSummary } from "@kibali/shared";
import { requireMember } from "@/lib/auth";
import { resolveLocation } from "@/lib/location";
import { createClient } from "@/lib/supabase/server";
import { TodayList, type TodayExpense, type TodayLoss } from "./today-list";

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ location?: string }>;
}) {
  const member = await requireMember();
  const { location: locationParam } = await searchParams;
  const { location } = await resolveLocation(member, locationParam);
  if (!location) redirect("/home");

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [sales, expenses, losses, deliveries] = await Promise.all([
    supabase.from("v_sale_summary").select("*").eq("location_id", location.id).eq("sale_date", today),
    supabase
      .from("expenses")
      .select("id, category, amount, description")
      .eq("location_id", location.id)
      .eq("expense_date", today)
      .is("deleted_at", null),
    supabase
      .from("stock_losses")
      .select("id, quantity, unit_level, reason, products(name)")
      .eq("location_id", location.id)
      .eq("loss_date", today)
      .is("deleted_at", null),
    supabase
      .from("v_delivery_summary")
      .select("*")
      .eq("location_id", location.id)
      .eq("delivery_date", today),
  ]);

  return (
    <TodayList
      locationName={location.name}
      sales={(sales.data ?? []) as SaleSummary[]}
      expenses={(expenses.data ?? []) as TodayExpense[]}
      losses={(losses.data ?? []).map((l) => ({
        id: l.id,
        quantity: l.quantity,
        unit_level: l.unit_level,
        reason: l.reason,
        product_name: (l.products as unknown as { name: string })?.name ?? "",
      }))}
      deliveries={(deliveries.data ?? []) as DeliverySummary[]}
    />
  );
}
