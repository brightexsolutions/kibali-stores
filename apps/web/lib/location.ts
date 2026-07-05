import "server-only";
import { cache } from "react";
import type { Location, SessionMember } from "@kibali/shared";
import { createClient } from "@/lib/supabase/server";
import { getViewCookie } from "@/lib/view";

export interface LocationWithBusiness extends Location {
  business_name: string;
}

/**
 * All shops the member can use (manager: theirs; owners: every shop).
 * cache()d per request — the layout (view switcher), the page, and
 * resolveLocation all need this list; fetch it once per navigation.
 */
export const listAccessibleLocations = cache(async (
  member: SessionMember
): Promise<LocationWithBusiness[]> => {
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
});

/**
 * Which shop is this screen about?
 * Managers are pinned to their shop. Owners resolve in this order:
 *   1. explicit ?location= param ("main" = Main store, i.e. no shop)
 *   2. their chosen working environment (the view cookie set by the switcher)
 *   3. the only shop, if there is exactly one
 */
export async function resolveLocation(
  member: SessionMember,
  requestedId?: string
): Promise<{ location: LocationWithBusiness | null; all: LocationWithBusiness[] }> {
  const all = await listAccessibleLocations(member);
  if (member.role === "manager") {
    return { location: all.find((l) => l.id === member.locationId) ?? null, all };
  }
  if (requestedId === "main") return { location: null, all };
  if (requestedId) {
    return { location: all.find((l) => l.id === requestedId) ?? null, all };
  }
  const view = await getViewCookie();
  if (view && view !== "all") {
    const fromView = all.find((l) => l.id === view);
    if (fromView) return { location: fromView, all };
  }
  return { location: all.length === 1 ? all[0] : null, all };
}
