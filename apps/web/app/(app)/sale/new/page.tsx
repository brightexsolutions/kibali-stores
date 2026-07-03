import { redirect } from "next/navigation";
import type { Product, StockLevel } from "@kibali/shared";
import { requireMember } from "@/lib/auth";
import { resolveLocation } from "@/lib/location";
import { createClient } from "@/lib/supabase/server";
import { SaleWizard } from "./sale-wizard";

export default async function NewSalePage({
  searchParams,
}: {
  searchParams: Promise<{ location?: string }>;
}) {
  const member = await requireMember();
  const { location: locationParam } = await searchParams;
  const { location } = await resolveLocation(member, locationParam);
  if (!location) redirect("/home");

  const supabase = await createClient();
  const [{ data: products }, { data: stock }] = await Promise.all([
    supabase
      .from("products")
      .select("*")
      .eq("business_id", location.business_id)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("name"),
    supabase.from("v_stock_levels").select("*").eq("location_id", location.id),
  ]);

  return (
    <SaleWizard
      locationId={location.id}
      locationName={location.name}
      products={(products ?? []) as Product[]}
      stock={(stock ?? []) as StockLevel[]}
    />
  );
}
