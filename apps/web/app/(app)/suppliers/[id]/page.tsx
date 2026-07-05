import { notFound } from "next/navigation";
import type { DeliveryProgress, DeliverySummary, SupplierBalance, SupplierPayment } from "@kibali/shared";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SupplierDetail } from "./supplier-detail";

export default async function SupplierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOwner();
  const { id } = await params;
  const supabase = await createClient();

  // Everything filters by the id directly — one round-trip instead of two.
  const [{ data: supplier }, { data: balance }, { data: summaries }, { data: progress }, { data: payments }] =
    await Promise.all([
      supabase
        .from("suppliers")
        .select("id, business_id, name, phone, notes")
        .eq("id", id)
        .is("deleted_at", null)
        .maybeSingle(),
      supabase.from("v_supplier_balances").select("*").eq("supplier_id", id).maybeSingle(),
      supabase
        .from("v_delivery_summary")
        .select("*")
        .eq("supplier_id", id)
        .order("delivery_date", { ascending: false }),
      supabase.from("v_delivery_progress").select("*").eq("supplier_id", id),
      supabase
        .from("supplier_payments")
        .select("id, supplier_id, delivery_id, amount, paid_on, method")
        .eq("supplier_id", id)
        .is("deleted_at", null)
        .order("paid_on", { ascending: false }),
    ]);
  if (!supplier) notFound();

  return (
    <SupplierDetail
      supplier={supplier}
      balance={(balance ?? null) as SupplierBalance | null}
      deliveries={(summaries ?? []) as DeliverySummary[]}
      progress={(progress ?? []) as DeliveryProgress[]}
      payments={(payments ?? []) as SupplierPayment[]}
    />
  );
}
