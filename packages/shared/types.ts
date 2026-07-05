/**
 * Central shared types for ALL Kibali Stores apps.
 * Every interface used across screens/apps lives here — one place to manage.
 *
 * Repeating fields are defined once in the base interfaces below and
 * everything else extends them.
 */

// ---------- Base interfaces (shared fields, defined once) ----------

/** Every table row has a UUID primary key. */
export interface Entity {
  id: string;
}

/** Standard timestamps — optional because queries don't always select them. */
export interface Timestamps {
  created_at?: string;
  updated_at?: string;
}

/** Soft delete — null/absent means the row is live. */
export interface SoftDeletable {
  deleted_at?: string | null;
}

/** Base for plain rows (id + timestamps). */
export interface BaseRow extends Entity, Timestamps {}

/** Base for catalog rows the owners manage (soft-deletable). */
export interface CatalogRow extends BaseRow, SoftDeletable {}

/** Base for day-to-day records: who entered it + soft delete. */
export interface OwnedRecord extends CatalogRow {
  created_by: string;
}

// ---------- Enums (mirror supabase/migrations/001_schema.sql) ----------
export type MemberRole = "super_admin" | "owner" | "manager";
export type SaleType = "wholesale" | "retail";
export type UnitLevel = "box" | "piece";
export type ExpenseCategory = "rent" | "salary" | "electricity" | "other";
export type CapitalEntryType = "investment" | "reinvested_profit";
export type AllocationStatus = "pending" | "disbursed" | "returned_to_business";
export type DistributionStatus = "draft" | "confirmed";
export type PaymentStatus = "unpaid" | "partially_paid" | "paid";
export type BatchStatus = "selling" | "finished";

// ---------- Row interfaces (tables) ----------
export interface Profile extends Entity, Timestamps {
  email: string;
  full_name: string;
  phone: string | null;
  must_change_password: boolean;
}

export interface Member extends BaseRow {
  user_id: string;
  role: MemberRole;
  location_id: string | null; // null for super_admin/owner (sees all)
  is_active: boolean;
}

export interface Business extends CatalogRow {
  name: string;
  description: string | null;
}

export interface Location extends CatalogRow {
  business_id: string;
  name: string;
  monthly_rent: number | null;
}

export interface Supplier extends CatalogRow {
  business_id: string;
  name: string;
  phone: string | null;
  notes: string | null;
}

export interface Product extends CatalogRow {
  business_id: string;
  name: string;
  unit_name: string; // "box", "carton"
  piece_name: string; // "ice pop", "packet"
  pieces_per_unit: number;
  cost_price: number; // usual cost per box — prefill only
  wholesale_price: number; // per box
  retail_price_per_piece: number;
  low_stock_threshold: number; // in boxes
  reorder_buffer_days: number;
  is_active: boolean;
}

export interface Delivery extends OwnedRecord {
  location_id: string | null; // null = Main store (central)
  supplier_id: string;
  delivery_date: string;
  total_cost: number;
  notes: string | null;
}

export interface DeliveryItem extends BaseRow {
  delivery_id: string;
  product_id: string;
  quantity: number; // boxes
  unit_cost: number; // snapshot — actual price paid this delivery
  unit_wholesale_price: number; // snapshot
}

export interface StockDistribution extends OwnedRecord {
  delivery_id: string | null;
  location_id: string;
  product_id: string;
  quantity: number; // boxes
  distribution_date: string;
}

export interface SupplierPayment extends OwnedRecord {
  supplier_id: string;
  delivery_id: string | null;
  amount: number;
  paid_on: string;
  method: string | null;
}

export interface Sale extends OwnedRecord {
  location_id: string;
  sale_date: string;
  sale_type: SaleType;
  customer_name: string | null;
}

export interface SaleItem extends BaseRow {
  sale_id: string;
  product_id: string;
  quantity: number;
  unit_level: UnitLevel; // box (wholesale) or piece (retail)
  unit_price: number; // charged at that level
  unit_cost: number; // cost snapshot at that level
}

export interface Expense extends OwnedRecord {
  location_id: string;
  category: ExpenseCategory;
  amount: number;
  expense_date: string;
  description: string | null;
}

export interface StockLoss extends OwnedRecord {
  location_id: string;
  product_id: string;
  quantity: number;
  unit_level: UnitLevel;
  unit_cost: number; // snapshot at that level
  reason: string;
  loss_date: string;
}

export interface Investor extends CatalogRow {
  name: string;
  phone: string | null;
  user_id: string | null; // most investors have no login
  share_link_token: string;
  is_active: boolean;
  notes: string | null;
}

export interface CapitalEntry extends OwnedRecord {
  investor_id: string;
  business_id: string | null; // null = invested in all of Kibali
  amount: number;
  entry_type: CapitalEntryType;
  entry_date: string;
  notes: string | null;
}

export interface ProfitDistribution extends OwnedRecord {
  business_id: string | null; // null = all of Kibali
  period_label: string;
  total_profit: number;
  distribution_date: string;
  status: DistributionStatus;
  notes: string | null;
}

export interface DistributionAllocation extends BaseRow {
  distribution_id: string;
  investor_id: string;
  share_pct: number; // snapshot at distribution time
  amount: number;
  status: AllocationStatus;
  settled_on: string | null; // dated Disburse / Return action
}

export interface AuditLog extends Entity {
  actor_id: string;
  action: string;
  entity: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string; // always selected for the activity screen
}

// ---------- View row interfaces (supabase/migrations/003_views.sql) ----------

/** Shared product columns most stock views expose. */
export interface ProductStockBase {
  location_id: string | null; // null = Main store
  product_id: string;
  business_id: string;
  product_name: string;
  unit_name: string;
  pieces_per_unit: number;
  pieces_on_hand: number;
  boxes_on_hand: number;
  loose_pieces: number;
}

export interface StockLevel extends ProductStockBase {
  piece_name: string;
  wholesale_price: number;
  retail_price_per_piece: number;
  low_stock_threshold: number;
  reorder_buffer_days: number;
}

export interface ReorderStatus extends ProductStockBase {
  pieces_per_day: number;
  days_of_stock_left: number | null;
  last_order_boxes: number | null;
  last_order_date: string | null;
  suggested_order_boxes: number | null;
  order_soon: boolean;
}

export interface DeliverySummary {
  delivery_id: string;
  location_id: string | null;
  supplier_id: string;
  delivery_date: string;
  total_cost: number;
  expected_revenue: number;
  expected_profit: number;
  amount_paid: number;
  balance_owed: number;
  payment_status: PaymentStatus;
}

export interface DeliveryProgress {
  delivery_id: string;
  location_id: string | null;
  supplier_id: string;
  delivery_date: string;
  total_cost: number;
  total_pieces: number;
  sold_pieces: number;
  lost_pieces: number;
  pieces_remaining: number;
  status: BatchStatus;
  realized_revenue: number;
  attributed_loss_value: number;
  realized_profit: number; // "profit so far" while selling; banked when finished
}

export interface SupplierBalance {
  supplier_id: string;
  business_id: string;
  name: string;
  total_delivered: number;
  total_paid: number;
  balance_owed: number;
}

export interface SaleSummary {
  sale_id: string;
  location_id: string;
  sale_date: string;
  sale_type: SaleType;
  created_by: string;
  total_amount: number;
  total_cost: number;
  profit: number;
}

export interface DailyLocationSummary {
  location_id: string;
  day: string;
  sales_total: number;
  cogs_total: number;
  cash_expenses: number;
  loss_value: number;
  actual_profit: number;
}

export interface InvestorSummary {
  investor_id: string;
  name: string;
  phone: string | null;
  user_id: string | null;
  is_active: boolean;
  capital: number;
  share_pct: number;
  total_disbursed: number;
  total_returned: number;
  pending_amount: number;
  pending_count: number;
}

export interface CapitalHistoryEntry {
  entry_id: string;
  investor_id: string;
  investor_name: string;
  business_id: string | null;
  amount: number;
  entry_type: CapitalEntryType;
  entry_date: string;
  notes: string | null;
  created_at: string;
  running_capital: number;
  running_total_capital: number;
  share_pct_after: number;
}

// ---------- App-level shared shapes ----------
export interface SessionMember {
  userId: string;
  email: string;
  fullName: string;
  role: MemberRole;
  locationId: string | null; // null for super_admin/owner
  mustChangePassword: boolean;
}

/** Plain-English labels used across all screens — write once, reuse. */
export const EXPENSE_LABELS: Record<ExpenseCategory, string> = {
  rent: "Rent",
  salary: "Salary",
  electricity: "Electricity",
  other: "Other",
};

export const ROLE_LABELS: Record<MemberRole, string> = {
  super_admin: "Super Admin",
  owner: "Owner",
  manager: "Shop Manager",
};

export const LOSS_REASONS = ["Melted", "Expired", "Broken", "Other"] as const;

/**
 * Shop logins: each shop can have its own account (code + password) instead
 * of a personal email. Supabase auth still needs an email under the hood, so
 * the code is wrapped in a synthetic address on this domain — never emailed.
 */
export const SHOP_LOGIN_DOMAIN = "shops.kibali.local";

export function isShopLoginEmail(email: string): boolean {
  return email.toLowerCase().endsWith(`@${SHOP_LOGIN_DOMAIN}`);
}

export function shopCodeFromEmail(email: string): string {
  return email.split("@")[0];
}

/** "Migori Shop" -> "migori-shop" */
export function slugifyShopCode(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Uniform result shape returned by every server action in every app. */
export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };
