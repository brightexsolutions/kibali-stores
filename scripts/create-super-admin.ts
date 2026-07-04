/**
 * Kibali Stores — bootstrap the first super admin account.
 *
 * Every other account (owners, managers, and — once this script has run
 * once — additional super admins) is created in-app at /team by an
 * existing super admin. But that flow requires already being logged in
 * as a super admin, so the very FIRST one has to be created directly
 * against Supabase, outside the app. That's what this script does.
 *
 * Safe to run again later for a second super admin if needed — it will
 * just error out cleanly if the email already exists.
 *
 * Usage:
 *   npm run create-super-admin -- "Full Name" "email@example.com" "+254700000000"
 *
 * The phone number is optional. A temporary password is generated and
 * printed once — share it with the person and have them change it on
 * first login (the app already forces a password change for new accounts).
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const envFile = resolve(__dirname, "../apps/web/.env.local");
for (const line of readFileSync(envFile, "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || url.includes("placeholder")) {
  console.error("Set real Supabase credentials in apps/web/.env.local first.");
  process.exit(1);
}

const [fullName, email, phone] = process.argv.slice(2);
if (!fullName || !email) {
  console.error(
    '\nUsage: npm run create-super-admin -- "Full Name" "email@example.com" "+254700000000"\n'
  );
  process.exit(1);
}

function tempPassword() {
  return `Kib-${randomBytes(4).toString("hex")}-${randomBytes(1).toString("hex")}`;
}

async function main() {
  const db = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const password = tempPassword();
  const { data: created, error: createError } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, phone: phone || null },
  });
  if (createError) {
    console.error("✗ Could not create the user:", createError.message);
    process.exit(1);
  }

  const { error: memberError } = await db.from("members").insert({
    user_id: created.user.id,
    role: "super_admin",
    location_id: null,
  });
  if (memberError) {
    console.error("✗ Could not assign super_admin role:", memberError.message);
    await db.auth.admin.deleteUser(created.user.id); // don't leave a half-made account
    process.exit(1);
  }

  console.log(
    `\n✓ Super admin created.\n` +
      `  Email:    ${email}\n` +
      `  Password: ${password}\n\n` +
      `Share these with ${fullName} — the app will force a password change on first login.\n`
  );
}

main();
