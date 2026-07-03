import type { StockLevel } from "@kibali/shared";
import { requireOwner } from "@/lib/auth";
import { listAccessibleLocations } from "@/lib/location";
import { createClient } from "@/lib/supabase/server";
import { DistributeForm } from "./distribute-form";

export default async function DistributePage() {
  const member = await requireOwner();
  const locations = await listAccessibleLocations(member);

  const supabase = await createClient();
  const { data: mainStock } = await supabase
    .from("v_stock_levels")
    .select("*")
    .is("location_id", null)
    .gt("pieces_on_hand", 0);

  return (
    <DistributeForm
      locations={locations.map((l) => ({
        id: l.id,
        name: l.name,
        business_id: l.business_id,
        business_name: l.business_name,
      }))}
      mainStock={(mainStock ?? []) as StockLevel[]}
    />
  );
}
