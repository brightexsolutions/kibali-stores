import "server-only";
import { randomBytes } from "node:crypto";
import { SHOP_LOGIN_DOMAIN, isShopLoginEmail, shopCodeFromEmail, slugifyShopCode } from "@kibali/shared";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ShopLoginCredentials {
  code: string;
  tempPassword: string;
}

/**
 * A password a branch can actually remember: the shop's first word +
 * a 4-digit number, e.g. "Migori@4821". Easy to hand over and keep using,
 * but not a fixed value anyone could guess. The owner can reset it any time.
 */
function memorablePassword(code: string) {
  const word = code.split("-")[0] || "shop";
  const capitalized = word.charAt(0).toUpperCase() + word.slice(1);
  const pin = 1000 + (randomBytes(2).readUInt16BE(0) % 9000);
  return `${capitalized}@${pin}`;
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

  const password = memorablePassword(code);
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

  // Branch keeps this memorable password — don't force a change on first login.
  await admin.from("profiles").update({ must_change_password: false }).eq("id", created.user.id);

  return { credentials: { code, tempPassword: password }, userId: created.user.id };
}

/**
 * Reset an existing shop login to a fresh memorable password (keeps the same
 * shop code, no forced change) — used when a branch forgets it or staff change.
 */
export async function resetShopLoginPassword(
  locationId: string
): Promise<{ credentials: ShopLoginCredentials; userId: string } | { error: string }> {
  const admin = createAdminClient();

  const { data: members } = await admin
    .from("members")
    .select("user_id, profiles(email)")
    .eq("location_id", locationId)
    .eq("role", "manager")
    .eq("is_active", true);
  const shopMember = (members ?? []).find((m) =>
    isShopLoginEmail((m.profiles as unknown as { email: string })?.email ?? "")
  );
  if (!shopMember) return { error: "This shop has no shop login yet." };

  const email = (shopMember.profiles as unknown as { email: string }).email;
  const code = shopCodeFromEmail(email);
  const password = memorablePassword(code);

  const { error } = await admin.auth.admin.updateUserById(shopMember.user_id, { password });
  if (error) {
    console.error("[shop-login] reset", error.message);
    return { error: "Could not reset the password. Try again." };
  }
  await admin.from("profiles").update({ must_change_password: false }).eq("id", shopMember.user_id);

  return { credentials: { code, tempPassword: password }, userId: shopMember.user_id };
}
