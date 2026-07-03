import "server-only";
import type { Location, SessionMember } from "@kibali/shared";
import { createClient } from "@/lib/supabase/server";

export interface LocationWithBusiness extends Location {
  business_name: string;
}

/** All shops the member can use (manager: theirs; owners: every shop). */
export async function listAccessibleLocations(
  member: SessionMember
): Promise<LocationWithBusiness[]> {
  const supabase = await createClient();
  let query = supabase
    .from("locations")
    .select("id, business_id, name, monthly_rent, businesses(name)")
    .is("deleted_at", null)
    .order("name");
  if (member.role === "manager" && member.locationId) {
    query = query.eq("id", member.locationId);
  }
  const { data } = await query;
  return (data ?? []).map((l) => ({
    id: l.id,
    business_id: l.business_id,
    name: l.name,
    monthly_rent: l.monthly_rent,
    business_name: (l.businesses as unknown as { name: string })?.name ?? "",
  }));
}

/**
 * Which shop is this screen about?
 * Managers are pinned to their shop; owners pick via ?location= (or the only/first one).
 */
export async function resolveLocation(
  member: SessionMember,
  requestedId?: string
): Promise<{ location: LocationWithBusiness | null; all: LocationWithBusiness[] }> {
  const all = await listAccessibleLocations(member);
  if (member.role === "manager") {
    return { location: all.find((l) => l.id === member.locationId) ?? null, all };
  }
  const location = requestedId
    ? all.find((l) => l.id === requestedId) ?? null
    : all.length === 1
      ? all[0]
      : null;
  return { location, all };
}
