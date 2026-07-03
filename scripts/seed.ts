/**
 * Kibali Stores — seed script (M1 verification data).
 * Run AFTER migrations 001–003 with: npm run seed
 * Reads apps/web/.env.local for SUPABASE_SERVICE_ROLE_KEY (server-side only).
 *
 * Creates: test users (1 super admin, 1 owner, 2 managers), 2 businesses,
 * 3 locations, 2 suppliers, 8 products, a month of records including
 * one FINISHED delivery batch, one in-progress batch, one partially-paid
 * delivery, a central (Main store) delivery with distributions,
 * expenses (rent/salary/electricity), spoilage, and 3 investors with capital.
 *
 * Test logins (password for all: KibaliTest!2026):
 *   super admin  godwin@kibali.test
 *   owner        parent@kibali.test
 *   manager A    manager.a@kibali.test  (Tala Shop)
 *   manager B    manager.b@kibali.test  (Kangundo Shop)
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// --- env ---------------------------------------------------------------
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

const PASSWORD = "KibaliTest!2026";
const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return d.toISOString().slice(0, 10);
};

async function fail(step: string, error: unknown): Promise<never> {
  console.error(`✗ ${step}:`, error);
  process.exit(1);
}

async function createUser(email: string, full_name: string) {
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name },
  });
  if (error) return fail(`create user ${email}`, error);
  return data.user.id;
}

async function insert<T extends object>(table: string, rows: T[]): Promise<any[]> {
  const { data, error } = await db.from(table).insert(rows).select();
  if (error) return fail(`insert ${table}`, error);
  return data!;
}

async function main() {
  // guard against double-seeding
  const { data: existing } = await db.from("businesses").select("id").limit(1);
  if (existing && existing.length > 0) {
    console.error("Database already has businesses — refusing to re-seed.");
    process.exit(1);
  }

  console.log("Creating users…");
  const godwin = await createUser("godwin@kibali.test", "Godwin (Super Admin)");
  const parent = await createUser("parent@kibali.test", "Mama Kibali");
  const managerA = await createUser("manager.a@kibali.test", "Jane (Tala)");
  const managerB = await createUser("manager.b@kibali.test", "Peter (Kangundo)");

  console.log("Businesses & locations…");
  const [frozen, shop] = await insert("businesses", [
    { name: "Frozen Treats", description: "Ice pops, lollies and biscuits" },
    { name: "General Shop", description: "Everyday goods" },
  ]);
  const [tala, kangundo, town] = await insert("locations", [
    { business_id: frozen.id, name: "Tala Shop", monthly_rent: 6000 },
    { business_id: frozen.id, name: "Kangundo Shop", monthly_rent: 4500 },
    { business_id: shop.id, name: "Town Shop", monthly_rent: 8000 },
  ]);

  console.log("Members…");
  await insert("members", [
    { user_id: godwin, role: "super_admin" },
    { user_id: parent, role: "owner" },
    { user_id: managerA, role: "manager", location_id: tala.id },
    { user_id: managerB, role: "manager", location_id: kangundo.id },
  ]);

  console.log("Suppliers & products…");
  const [factory, wholesaler] = await insert("suppliers", [
    { business_id: frozen.id, name: "Sweet Factory Ltd", phone: "0700 000001" },
    { business_id: frozen.id, name: "Machakos Wholesalers", phone: "0700 000002" },
  ]);
  const products = await insert("products", [
    { business_id: frozen.id, name: "Ice Pop (10 bob)", unit_name: "box", piece_name: "ice pop", pieces_per_unit: 50, cost_price: 300, wholesale_price: 350, retail_price_per_piece: 10, low_stock_threshold: 10 },
    { business_id: frozen.id, name: "Ice Lolly (15 bob)", unit_name: "box", piece_name: "ice lolly", pieces_per_unit: 40, cost_price: 380, wholesale_price: 440, retail_price_per_piece: 15, low_stock_threshold: 8 },
    { business_id: frozen.id, name: "Ice Pop Small (5 bob)", unit_name: "box", piece_name: "ice pop", pieces_per_unit: 100, cost_price: 330, wholesale_price: 380, retail_price_per_piece: 5, low_stock_threshold: 10 },
    { business_id: frozen.id, name: "Biscuits Packet", unit_name: "carton", piece_name: "packet", pieces_per_unit: 24, cost_price: 480, wholesale_price: 560, retail_price_per_piece: 30, low_stock_threshold: 5 },
    { business_id: shop.id, name: "Sugar 1kg", unit_name: "bale", piece_name: "packet", pieces_per_unit: 12, cost_price: 1500, wholesale_price: 1680, retail_price_per_piece: 150, low_stock_threshold: 4 },
    { business_id: shop.id, name: "Maize Flour 2kg", unit_name: "bale", piece_name: "packet", pieces_per_unit: 12, cost_price: 1300, wholesale_price: 1450, retail_price_per_piece: 130, low_stock_threshold: 4 },
    { business_id: shop.id, name: "Cooking Oil 1L", unit_name: "carton", piece_name: "bottle", pieces_per_unit: 12, cost_price: 2000, wholesale_price: 2280, retail_price_per_piece: 205, low_stock_threshold: 3 },
    { business_id: frozen.id, name: "Juice Pouch", unit_name: "box", piece_name: "pouch", pieces_per_unit: 30, cost_price: 240, wholesale_price: 290, retail_price_per_piece: 12, low_stock_threshold: 6 },
  ]);
  const icePop = products[0];
  const iceLolly = products[1];

  // ---------------------------------------------------------------------
  // Delivery 1 (Tala, 28 days ago): 10 boxes ice pop @300 — FINISHED batch.
  // 500 pieces: 6 boxes sold wholesale, 180 pieces retail, 20 pieces spoiled.
  // Fully paid. Expected profit = 10*350 - 3000 = 500.
  // Realized revenue = 6*350 + 180*10 = 3900; loss = 20*6 = 120 → profit 780.
  // ---------------------------------------------------------------------
  console.log("Delivery 1 — finished batch…");
  const [d1] = await insert("deliveries", [
    { location_id: tala.id, supplier_id: factory.id, delivery_date: day(28), total_cost: 3000, created_by: parent },
  ]);
  await insert("delivery_items", [
    { delivery_id: d1.id, product_id: icePop.id, quantity: 10, unit_cost: 300, unit_wholesale_price: 350 },
  ]);
  await insert("supplier_payments", [
    { supplier_id: factory.id, delivery_id: d1.id, amount: 2000, paid_on: day(28), method: "cash", created_by: parent },
    { supplier_id: factory.id, delivery_id: d1.id, amount: 1000, paid_on: day(20), method: "M-Pesa", created_by: parent },
  ]);
  // wholesale sales: 6 boxes over 3 days
  for (const [offset, boxes] of [[26, 2], [24, 2], [22, 2]] as const) {
    const [s] = await insert("sales", [
      { location_id: tala.id, sale_date: day(offset), sale_type: "wholesale", created_by: managerA },
    ]);
    await insert("sale_items", [
      { sale_id: s.id, product_id: icePop.id, quantity: boxes, unit_level: "box", unit_price: 350, unit_cost: 300 },
    ]);
  }
  // retail: 180 pieces over 4 days
  for (const [offset, pieces] of [[21, 50], [19, 50], [17, 40], [15, 40]] as const) {
    const [s] = await insert("sales", [
      { location_id: tala.id, sale_date: day(offset), sale_type: "retail", created_by: managerA },
    ]);
    await insert("sale_items", [
      { sale_id: s.id, product_id: icePop.id, quantity: pieces, unit_level: "piece", unit_price: 10, unit_cost: 6 },
    ]);
  }
  await insert("stock_losses", [
    { location_id: tala.id, product_id: icePop.id, quantity: 20, unit_level: "piece", unit_cost: 6, reason: "melted", loss_date: day(16), created_by: managerA },
  ]);

  // ---------------------------------------------------------------------
  // Delivery 2 (central Main store, 10 days ago): 20 boxes ice lolly @380,
  // PARTIALLY PAID (5000 of 7600). Distributed 12 boxes to Kangundo,
  // 4 to Tala; 4 boxes still in Main store. Batch IN PROGRESS.
  // ---------------------------------------------------------------------
  console.log("Delivery 2 — central, partially paid, in progress…");
  const [d2] = await insert("deliveries", [
    { location_id: null, supplier_id: wholesaler.id, delivery_date: day(10), total_cost: 7600, created_by: parent },
  ]);
  await insert("delivery_items", [
    { delivery_id: d2.id, product_id: iceLolly.id, quantity: 20, unit_cost: 380, unit_wholesale_price: 440 },
  ]);
  await insert("supplier_payments", [
    { supplier_id: wholesaler.id, delivery_id: d2.id, amount: 5000, paid_on: day(10), method: "M-Pesa", created_by: parent },
  ]);
  await insert("stock_distributions", [
    { location_id: kangundo.id, product_id: iceLolly.id, quantity: 12, distribution_date: day(9), created_by: parent },
    { location_id: tala.id, product_id: iceLolly.id, quantity: 4, distribution_date: day(9), created_by: parent },
  ]);
  // Kangundo sells some lollies
  for (const [offset, boxes] of [[8, 3], [5, 2]] as const) {
    const [s] = await insert("sales", [
      { location_id: kangundo.id, sale_date: day(offset), sale_type: "wholesale", created_by: managerB },
    ]);
    await insert("sale_items", [
      { sale_id: s.id, product_id: iceLolly.id, quantity: boxes, unit_level: "box", unit_price: 440, unit_cost: 380 },
    ]);
  }
  const [retailK] = await insert("sales", [
    { location_id: kangundo.id, sale_date: day(3), sale_type: "retail", created_by: managerB },
  ]);
  await insert("sale_items", [
    { sale_id: retailK.id, product_id: iceLolly.id, quantity: 60, unit_level: "piece", unit_price: 15, unit_cost: 9.5 },
  ]);

  // ---------------------------------------------------------------------
  // Expenses: rent, salaries, electricity (fridges), misc
  // ---------------------------------------------------------------------
  console.log("Expenses…");
  await insert("expenses", [
    { location_id: tala.id, category: "rent", amount: 6000, expense_date: day(25), description: "June rent", created_by: parent },
    { location_id: kangundo.id, category: "rent", amount: 4500, expense_date: day(25), description: "June rent", created_by: parent },
    { location_id: tala.id, category: "salary", amount: 8000, expense_date: day(2), description: "Jane salary", created_by: parent },
    { location_id: kangundo.id, category: "salary", amount: 8000, expense_date: day(2), description: "Peter salary", created_by: parent },
    { location_id: tala.id, category: "electricity", amount: 1200, expense_date: day(6), description: "Fridge power token", created_by: managerA },
    { location_id: kangundo.id, category: "electricity", amount: 950, expense_date: day(6), description: "Fridge power token", created_by: managerB },
    { location_id: tala.id, category: "other", amount: 300, expense_date: day(12), description: "Cleaning supplies", created_by: managerA },
  ]);

  // ---------------------------------------------------------------------
  // Investors: A 60,000 (all Kibali), B 40,000 (all), C 25,000 (Frozen only)
  // ---------------------------------------------------------------------
  console.log("Investors & capital…");
  const [invA, invB, invC] = await insert("investors", [
    { name: "Mama Kibali", phone: "0700 111111", notes: "Founder" },
    { name: "Baba Kibali", phone: "0700 222222", notes: "Founder" },
    { name: "Godwin", phone: "0700 333333", notes: "Son — invested in Frozen Treats" },
  ]);
  await insert("capital_entries", [
    { investor_id: invA.id, business_id: null, amount: 60000, entry_type: "investment", entry_date: day(60), created_by: godwin },
    { investor_id: invB.id, business_id: null, amount: 40000, entry_type: "investment", entry_date: day(60), created_by: godwin },
    { investor_id: invC.id, business_id: frozen.id, amount: 25000, entry_type: "investment", entry_date: day(45), created_by: godwin },
  ]);

  console.log(`
✓ Seed complete.
  Logins (password ${PASSWORD}):
    godwin@kibali.test      super admin
    parent@kibali.test      owner
    manager.a@kibali.test   manager — Tala Shop
    manager.b@kibali.test   manager — Kangundo Shop

  Hand-check numbers:
    Delivery 1 (Tala, ice pops): FINISHED — realized profit KSh 780
      (6×350 + 180×10 = 3,900 revenue − 3,000 cost − 120 melt loss)
    Delivery 2 (central lollies): SELLING — paid 5,000 of 7,600 (owed 2,600);
      Main store holds 4 boxes; Kangundo stock 12−5 boxes −60 pieces = 220 pieces.
`);
}

main().catch((e) => fail("seed", e));
