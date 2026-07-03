"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { accountSchema, type ActionResult } from "@kibali/shared";
import { getSessionMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAction } from "@/lib/audit";

async function requireSuperAdminAction() {
  const member = await getSessionMember();
  if (!member || member.role !== "super_admin") return null;
  return member;
}

function tempPassword() {
  // readable but strong: Kib-x9f3q2-7d
  return `Kib-${randomBytes(4).toString("hex")}-${randomBytes(1).toString("hex")}`;
}

/**
 * Super admin creates every account (no self-signup). Returns the temporary
 * password EXACTLY ONCE so it can be shared with the person.
 */
export async function createAccount(
  formData: FormData
): Promise<ActionResult<{ tempPassword: string }>> {
  const member = await requireSuperAdminAction();
  if (!member) return { ok: false, error: "Only the super admin can create accounts." };

  const parsed = accountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const input = parsed.data;

  const admin = createAdminClient();
  const password = tempPassword();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: input.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: input.full_name, phone: input.phone || null },
  });
  if (createError) {
    console.error("[team.createAccount] auth", createError.message);
    return {
      ok: false,
      error: createError.message.includes("already")
        ? "An account with this email already exists."
        : "Could not create the account. Try again.",
    };
  }

  const { error: memberError } = await admin.from("members").insert({
    user_id: created.user.id,
    role: input.role,
    location_id: input.role === "manager" ? input.location_id : null,
  });
  if (memberError) {
    console.error("[team.createAccount] member", memberError.message);
    await admin.auth.admin.deleteUser(created.user.id); // don't leave a half-made account
    return { ok: false, error: "Could not assign the role. Try again." };
  }

  const supabase = await createClient();
  await logAction(supabase, member.userId, "account.created", "member", created.user.id, {
    email: input.email,
    role: input.role,
    location_id: input.location_id || null,
  });

  revalidatePath("/team");
  return { ok: true, data: { tempPassword: password } };
}

export async function setMemberActive(memberId: string, active: boolean): Promise<ActionResult> {
  const actor = await requireSuperAdminAction();
  if (!actor) return { ok: false, error: "Only the super admin can do this." };

  const supabase = await createClient();
  const { error } = await supabase.from("members").update({ is_active: active }).eq("id", memberId);
  if (error) {
    console.error("[team.setMemberActive]", error.message);
    return { ok: false, error: "Could not update the account." };
  }

  await logAction(supabase, actor.userId, active ? "account.activated" : "account.deactivated", "member", memberId);
  revalidatePath("/team");
  return { ok: true };
}

/** Reset someone's password to a fresh temporary one (shown once). */
export async function resetPassword(
  userId: string
): Promise<ActionResult<{ tempPassword: string }>> {
  const actor = await requireSuperAdminAction();
  if (!actor) return { ok: false, error: "Only the super admin can do this." };

  const admin = createAdminClient();
  const password = tempPassword();

  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) {
    console.error("[team.resetPassword]", error.message);
    return { ok: false, error: "Could not reset the password." };
  }
  await admin.from("profiles").update({ must_change_password: true }).eq("id", userId);

  const supabase = await createClient();
  await logAction(supabase, actor.userId, "account.password_reset", "profile", userId);

  return { ok: true, data: { tempPassword: password } };
}
