import { redirect } from "next/navigation";
import type { Product, Supplier } from "@kibali/shared";
import { requireMember } from "@/lib/auth";
import { listAccessibleLocations } from "@/lib/location";
import { createClient } from "@/lib/supabase/server";
import { DeliveryForm } from "./delivery-form";

export default async function NewDeliveryPage({
  searchParams,
}: {
  searchParams: Promise<{ location?: string }>;
}) {
  const member = await requireMember();
  const { location: locationParam } = await searchParams;
  const locations = await listAccessibleLocations(member);
  if (member.role === "manager" && locations.length === 0) redirect("/home");

  const supabase = await createClient();
  // Managers: only their business's suppliers/products. Owners: everything.
  const businessIds =
    member.role === "manager" ? locations.map((l) => l.business_id) : undefined;

  let suppliersQuery = supabase
    .from("suppliers")
    .select("id, business_id, name, phone, notes")
    .is("deleted_at", null)
    .order("name");
  let productsQuery = supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("name");
  if (businessIds) {
    suppliersQuery = suppliersQuery.in("business_id", businessIds);
    productsQuery = productsQuery.in("business_id", businessIds);
  }
  const [{ data: suppliers }, { data: products }] = await Promise.all([
    suppliersQuery,
    productsQuery,
  ]);

  return (
    <DeliveryForm
      isOwner={member.role !== "manager"}
      locations={locations.map((l) => ({ id: l.id, name: l.name, business_name: l.business_name }))}
      defaultLocationId={member.role === "manager" ? member.locationId! : locationParam ?? ""}
      suppliers={(suppliers ?? []) as Supplier[]}
      products={(products ?? []) as Product[]}
    />
  );
}
