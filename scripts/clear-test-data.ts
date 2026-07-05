/**
 * Kibali Stores — clear ALL data and start fresh before real launch.
 *
 * ⚠️ DESTRUCTIVE. This deletes every business record (businesses, shops,
 * products, suppliers, deliveries, sales, expenses, losses, investors,
 * distributions, audit log) AND every user account — including the seed
 * super admin/owner/manager test logins. There is no undo.
 *
 * Do NOT run this until you are ready to enter your real businesses,
 * shops, products and team. Run scripts/create-super-admin.ts immediately
 * afterward — with everyone gone, no one can log in to use /team until
 * that script creates your first real account.
 *
 * Usage (the confirmation flag is required on purpose):
 *   npm run clear-data -- --yes-i-am-sure
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

if (!process.argv.includes("--yes-i-am-sure")) {
  console.error(
    "\nRefusing to run without --yes-i-am-sure.\n" +
      "This permanently deletes EVERYTHING — every business, shop, product,\n" +
      "supplier, sale, expense, delivery, investor, and every user account.\n" +
      "Re-run as: npm run clear-data -- --yes-i-am-sure\n"
  );
  process.exit(1);
}

const db = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Children first, then parents — matches the foreign-key dependency order.
// push_subscriptions cascade-delete when their user is removed, but we clear
// them here too for a truly empty slate. Tables that don't exist yet (e.g. if
// migration 004 hasn't been run) are skipped, not treated as errors.
const TABLES_IN_ORDER = [
  "notification_events",
  "push_subscriptions",
  "audit_logs",
  "distribution_allocations",
  "profit_distributions",
  "capital_entries",
  "investors",
  "stock_losses",
  "expenses",
  "sale_items",
  "sales",
  "delivery_items",
  "stock_distributions",
  "supplier_payments",
  "deliveries",
  "suppliers",
  "products",
  "members",
  "locations",
  "businesses",
];

async function clearTable(table: string) {
  // No universally-true WHERE clause needed — delete everything via an
  // "id is not null" filter (every table has a uuid id column).
  const { error, count } = await db.from(table).delete({ count: "exact" }).not("id", "is", null);
  if (error) {
    // A missing table (relation does not exist) just means that feature's
    // migration hasn't been run — nothing to clear, so move on.
    if (/does not exist|schema cache/i.test(error.message)) {
      console.log(`• ${table} — not present, skipped`);
      return;
    }
    console.error(`✗ ${table}:`, error.message);
    process.exit(1);
  }
  console.log(`✓ ${table} — removed ${count ?? 0} row(s)`);
}

async function clearAllUsers() {
  const { data, error } = await db.auth.admin.listUsers();
  if (error) {
    console.error("✗ listing users:", error.message);
    process.exit(1);
  }
  for (const user of data.users) {
    const { error: delError } = await db.auth.admin.deleteUser(user.id);
    if (delError) {
      console.error(`✗ deleting user ${user.email}:`, delError.message);
      process.exit(1);
    }
    console.log(`✓ removed user ${user.email}`);
  }
  // profiles cascade-delete automatically via the auth.users FK.
}

async function main() {
  console.log("Clearing all Kibali Stores data...\n");
  for (const table of TABLES_IN_ORDER) {
    await clearTable(table);
  }
  await clearAllUsers();
  console.log(
    "\n✓ Database is empty.\n" +
      "Next: run `npm run create-super-admin` to create your first real login.\n"
  );
}

main();
