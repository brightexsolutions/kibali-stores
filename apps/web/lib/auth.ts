import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { SessionMember } from "@kibali/shared";
import { createClient } from "@/lib/supabase/server";

/**
 * Load the signed-in user's profile + active membership (role, shop).
 * Wrapped in React cache() — the layout and the page both need this, and
 * without dedupe every navigation paid for the auth round-trips twice.
 */
export const getSessionMember = cache(async (): Promise<SessionMember | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: member }] = await Promise.all([
    supabase
      .from("profiles")
      .select("email, full_name, must_change_password")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("members")
      .select("role, location_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle(),
  ]);

  if (!profile || !member) return null;

  return {
    userId: user.id,
    email: profile.email,
    fullName: profile.full_name,
    role: member.role,
    locationId: member.location_id,
    mustChangePassword: profile.must_change_password,
  };
});

/** Guard for authenticated screens; forces first-login password change. */
export async function requireMember(opts?: { allowPasswordChange?: boolean }) {
  const member = await getSessionMember();
  if (!member) redirect("/welcome");
  if (member.mustChangePassword && !opts?.allowPasswordChange) {
    redirect("/account/password");
  }
  return member;
}

export async function requireOwner() {
  const member = await requireMember();
  if (member.role === "manager") redirect("/home");
  return member;
}

export async function requireSuperAdmin() {
  const member = await requireMember();
  if (member.role !== "super_admin") redirect("/");
  return member;
}
