import type { Location } from "@kibali/shared";
import { requireSuperAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TeamManager, type TeamRow } from "./team-manager";

export default async function TeamPage() {
  await requireSuperAdmin();
  const supabase = await createClient();

  const [{ data: members }, { data: profiles }, { data: locations }] = await Promise.all([
    supabase.from("members").select("id, user_id, role, location_id, is_active").order("created_at"),
    supabase.from("profiles").select("id, email, full_name, phone"),
    supabase.from("locations").select("id, business_id, name, monthly_rent").is("deleted_at", null).order("name"),
  ]);

  const rows: TeamRow[] = (members ?? []).map((m) => {
    const profile = (profiles ?? []).find((p) => p.id === m.user_id);
    return {
      memberId: m.id,
      userId: m.user_id,
      role: m.role,
      locationId: m.location_id,
      isActive: m.is_active,
      fullName: profile?.full_name ?? "(unknown)",
      email: profile?.email ?? "",
      phone: profile?.phone ?? null,
    };
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Team</h1>
        <p className="text-sm text-muted-foreground">
          You create every account here and share the login with the person.
        </p>
      </div>
      <TeamManager rows={rows} locations={(locations ?? []) as Location[]} />
    </div>
  );
}
