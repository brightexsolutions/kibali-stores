"use server";

import { revalidatePath } from "next/cache";
import { passwordChangeSchema, type ActionResult } from "@kibali/shared";
import { createClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/audit";

export async function changePassword(formData: FormData): Promise<ActionResult> {
  const parsed = passwordChangeSchema.safeParse({
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You are signed out. Sign in again." };

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    console.error("[account.changePassword]", error.message);
    return { ok: false, error: "Could not change the password. Try again." };
  }

  await supabase
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", user.id);

  await logAction(supabase, user.id, "account.password_changed", "profile", user.id);
  revalidatePath("/");
  return { ok: true };
}
