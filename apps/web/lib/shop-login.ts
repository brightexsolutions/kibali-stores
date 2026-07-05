import "server-only";
import { randomBytes } from "node:crypto";
import { SHOP_LOGIN_DOMAIN, isShopLoginEmail, slugifyShopCode } from "@kibali/shared";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ShopLoginCredentials {
  code: string;
  tempPassword: string;
}

function tempPassword() {
  return `Kib-${randomBytes(4).toString("hex")}-${randomBytes(1).toString("hex")}`;
}

/**
 * Create the shop's own login (code + temp password) for a location:
 * a manager-role account whose synthetic email is `<code>@shops.kibali.local`.
 * Returns null (not an exception) with an error message on failure so the
 * shop-creation flow can still succeed and offer a retry from /settings.
 */
export async function provisionShopLogin(location: {
  id: string;
  name: string;
}): Promise<{ credentials: ShopLoginCredentials; userId: string } | { error: string }> {
  const admin = createAdminClient();

  // One shop login per shop — check for an existing active one first.
  const { data: existingMembers } = await admin
    .from("members")
    .select("user_id, profiles(email)")
    .eq("location_id", location.id)
    .eq("role", "manager")
    .eq("is_active", true);
  const existing = (existingMembers ?? []).find((m) =>
    isShopLoginEmail((m.profiles as unknown as { email: string })?.email ?? "")
  );
  if (existing) return { error: "This shop already has a shop login." };

  // Unique code from the shop name: migori-shop, migori-shop-2, …
  const base = slugifyShopCode(location.name) || "shop";
  let code = base;
  for (let i = 2; i <= 20; i++) {
    const { data: taken } = await admin
      .from("profiles")
      .select("id")
      .eq("email", `${code}@${SHOP_LOGIN_DOMAIN}`)
      .maybeSingle();
    if (!taken) break;
    code = `${base}-${i}`;
  }

  const password = tempPassword();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: `${code}@${SHOP_LOGIN_DOMAIN}`,
    password,
    email_confirm: true,
    user_metadata: { full_name: `${location.name} (shop login)` },
  });
  if (createError) {
    console.error("[shop-login] auth", createError.message);
    return { error: "Could not create the shop login. Try again from Businesses & Shops." };
  }

  const { error: memberError } = await admin.from("members").insert({
    user_id: created.user.id,
    role: "manager",
    location_id: location.id,
  });
  if (memberError) {
    console.error("[shop-login] member", memberError.message);
    await admin.auth.admin.deleteUser(created.user.id); // don't leave a half-made account
    return { error: "Could not assign the shop login. Try again from Businesses & Shops." };
  }

  return { credentials: { code, tempPassword: password }, userId: created.user.id };
}
