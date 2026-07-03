import type { Business, Location } from "@kibali/shared";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SettingsManager } from "./settings-manager";

export default async function SettingsPage() {
  await requireOwner();
  const supabase = await createClient();

  const [{ data: businesses }, { data: locations }] = await Promise.all([
    supabase
      .from("businesses")
      .select("id, name, description")
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("locations")
      .select("id, business_id, name, monthly_rent")
      .is("deleted_at", null)
      .order("name"),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Businesses & Shops</h1>
        <p className="text-sm text-muted-foreground">
          Set up each business and the shops under it.
        </p>
      </div>
      <SettingsManager
        businesses={(businesses ?? []) as Business[]}
        locations={(locations ?? []) as Location[]}
      />
    </div>
  );
}
