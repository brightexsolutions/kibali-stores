/**
 * Central zod schemas — every mutation in every Kibali app validates here.
 * Server actions parse with these; clients may reuse them for instant feedback.
 */
import { z } from "zod";

const uuid = z.string().uuid();
const money = z.coerce.number().min(0).max(99_999_999);
const positiveMoney = z.coerce.number().positive().max(99_999_999);
const qty = z.coerce.number().int().positive().max(1_000_000);
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date");

// ---------- catalog ----------
export const businessSchema = z.object({
  name: z.string().trim().min(1, "Give the business a name").max(120),
  description: z.string().trim().max(500).optional().or(z.literal("")),
});

export const locationSchema = z.object({
  business_id: uuid,
  name: z.string().trim().min(1, "Give the shop a name").max(120),
  monthly_rent: money.optional().nullable(),
});

export const supplierSchema = z.object({
  business_id: uuid,
  name: z.string().trim().min(1, "Give the supplier a name").max(120),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export const productSchema = z.object({
  business_id: uuid,
  name: z.string().trim().min(1, "Give the product a name").max(120),
  unit_name: z.string().trim().min(1).max(30).default("box"),
  piece_name: z.string().trim().min(1).max(30).default("piece"),
  pieces_per_unit: qty,
  cost_price: money,
  wholesale_price: money,
  retail_price_per_piece: money,
  low_stock_threshold: z.coerce.number().int().min(0).max(100000).default(10),
  reorder_buffer_days: z.coerce.number().int().min(1).max(60).default(3),
});

// ---------- team ----------
export const accountSchema = z.object({
  full_name: z.string().trim().min(1, "Enter the person's name").max(120),
  email: z.string().trim().email("Enter a valid email"),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  role: z.enum(["owner", "manager", "super_admin"]),
  location_id: uuid.optional().or(z.literal("")),
}).refine((v) => v.role !== "manager" || !!v.location_id, {
  message: "A shop manager needs a shop",
  path: ["location_id"],
});

export const passwordChangeSchema = z.object({
  password: z.string().min(8, "At least 8 characters"),
});

// ---------- records ----------
export const saleItemSchema = z.object({
  product_id: uuid,
  quantity: qty,
  unit_level: z.enum(["box", "piece"]),
  unit_price: money,
});

export const saleSchema = z.object({
  location_id: uuid,
  sale_date: dateStr,
  sale_type: z.enum(["wholesale", "retail"]),
  customer_name: z.string().trim().max(120).optional().or(z.literal("")),
  items: z.array(saleItemSchema).min(1, "Add at least one item"),
});

export const expenseSchema = z.object({
  location_id: uuid,
  category: z.enum(["rent", "salary", "electricity", "other"]),
  amount: positiveMoney,
  expense_date: dateStr,
  description: z.string().trim().max(300).optional().or(z.literal("")),
});

export const deliveryItemSchema = z.object({
  product_id: uuid,
  quantity: qty,
  unit_cost: money,
  unit_wholesale_price: money,
});

export const deliverySchema = z.object({
  supplier_id: uuid,
  // empty string = Main store (central, distribute later)
  location_id: uuid.optional().or(z.literal("")),
  delivery_date: dateStr,
  total_cost: money,
  paid_now: money.optional(),
  payment_method: z.string().trim().max(40).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  items: z.array(deliveryItemSchema).min(1, "Add at least one item"),
});

export const lossSchema = z.object({
  location_id: uuid,
  product_id: uuid,
  quantity: qty,
  unit_level: z.enum(["box", "piece"]),
  reason: z.string().trim().min(1).max(60),
  loss_date: dateStr,
});

export const distributionSchema = z.object({
  location_id: uuid,
  distribution_date: dateStr,
  items: z
    .array(z.object({ product_id: uuid, quantity: qty }))
    .min(1, "Add at least one product"),
});

export const supplierPaymentSchema = z.object({
  supplier_id: uuid,
  delivery_id: uuid.optional().or(z.literal("")),
  amount: positiveMoney,
  paid_on: dateStr,
  method: z.string().trim().max(40).optional().or(z.literal("")),
});

// ---------- investors ----------
export const investorSchema = z.object({
  name: z.string().trim().min(1, "Enter the investor's name").max(120),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export const capitalEntrySchema = z.object({
  investor_id: uuid,
  business_id: uuid.optional().or(z.literal("")), // empty = all of Kibali
  amount: positiveMoney,
  entry_date: dateStr,
  notes: z.string().trim().max(300).optional().or(z.literal("")),
});

export const profitDistributionSchema = z.object({
  business_id: uuid.optional().or(z.literal("")), // empty = all of Kibali
  period_label: z.string().trim().min(1, "Name the period, e.g. June 2026").max(60),
  total_profit: positiveMoney,
  distribution_date: dateStr,
  notes: z.string().trim().max(300).optional().or(z.literal("")),
  allocations: z
    .array(z.object({ investor_id: uuid, share_pct: z.coerce.number().min(0).max(100), amount: money }))
    .min(1),
});

export const settleAllocationSchema = z.object({
  allocation_id: uuid,
  decision: z.enum(["disbursed", "returned_to_business"]),
  settled_on: dateStr,
});
