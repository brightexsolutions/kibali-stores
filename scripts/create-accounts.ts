/**
 * Kibali Stores — create the initial real accounts on a clean database.
 *
 * Creates the super admin (Godwin) and the two owners (Asha, Joseph) with
 * memorable passwords they can log in with straight away — must_change_password
 * is set to false on purpose so the parents are NOT forced to change it on
 * first login. They can still change it later in the app if they want.
 *
 * Safe to re-run: an account whose email already exists is skipped, not
 * duplicated.
 *
 *   npm run create-accounts
 */
import { createClient } from "@supabase/supabase-js";
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

const db = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type Role = "super_admin" | "owner";
interface Account {
  fullName: string;
  email: string;
  password: string;
  role: Role;
}

const ACCOUNTS: Account[] = [
  { fullName: "Godwin", email: "godwin@kibalistores.com", password: "Godwin@2026", role: "super_admin" },
  { fullName: "Asha", email: "asha@kibalistores.com", password: "Asha@2026", role: "owner" },
  { fullName: "Joseph", email: "joseph@kibalistores.com", password: "Joseph@2026", role: "owner" },
];

async function createAccount(acc: Account) {
  const { data: created, error: createError } = await db.auth.admin.createUser({
    email: acc.email,
    password: acc.password,
    email_confirm: true,
    user_metadata: { full_name: acc.fullName },
  });
  if (createError) {
    if (createError.message.includes("already")) {
      console.log(`• ${acc.email} — already exists, skipped`);
      return;
    }
    console.error(`✗ ${acc.email}:`, createError.message);
    process.exit(1);
  }

  const { error: memberError } = await db.from("members").insert({
    user_id: created.user.id,
    role: acc.role,
    location_id: null, // super_admin & owners see everything
  });
  if (memberError) {
    console.error(`✗ ${acc.email} role:`, memberError.message);
    await db.auth.admin.deleteUser(created.user.id); // don't leave a half-made account
    process.exit(1);
  }

  // Let them log in with the shared password directly — no forced change.
  await db.from("profiles").update({ must_change_password: false }).eq("id", created.user.id);

  console.log(`✓ ${acc.role.padEnd(11)} ${acc.email}  (password: ${acc.password})`);
}

async function main() {
  console.log("Creating initial Kibali Stores accounts...\n");
  for (const acc of ACCOUNTS) {
    await createAccount(acc);
  }
  console.log("\n✓ Done. Share each person's email + password with them.");
}

main();
