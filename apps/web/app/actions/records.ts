"use server";

import { revalidatePath } from "next/cache";
import {
  deliverySchema,
  distributionSchema,
  expenseSchema,
  lossSchema,
  saleSchema,
  supplierPaymentSchema,
  type ActionResult,
} from "@kibali/shared";
import { getSessionMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/audit";
import { notifyOwnersOnce } from "@/lib/push";

function firstIssue(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Check the form and try again.";
}

/** Managers may only touch their own shop; owners anywhere (incl. Main store). */
async function requireLocationAccess(locationId: string | null) {
  const member = await getSessionMember();
  if (!member) return null;
  if (member.role === "manager" && member.locationId !== locationId) return null;
  return member;
}

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

/**
 * Offline replays: a record submitted from the outbox carries a client_ref;
 * if it already landed (connection died after the save), treat as success.
 */
async function alreadySaved(supabase: SupabaseServer, table: string, clientRef?: string) {
  if (!clientRef) return false;
  const { data } = await supabase.from(table).select("id").eq("client_ref", clientRef).maybeSingle();
  return !!data;
}

/** After a sale/loss, warn owners about any hit product now at/below threshold. */
async function alertLowStock(supabase: SupabaseServer, locationId: string, productIds: string[]) {
  try {
    const [{ data: rows }, { data: location }] = await Promise.all([
      supabase
        .from("v_stock_levels")
        .select("product_id, product_name, boxes_on_hand, unit_name, low_stock_threshold")
        .eq("location_id", locationId)
        .in("product_id", productIds),
      supabase.from("locations").select("name").eq("id", locationId).maybeSingle(),
    ]);
    const shopName = location?.name ?? "a shop";
    for (const row of rows ?? []) {
      if (Number(row.boxes_on_hand) > row.low_stock_threshold) continue;
      await notifyOwnersOnce("low_stock", `${locationId}:${row.product_id}`, {
        title: "Order soon",
        body: `${row.product_name} at ${shopName}: ${row.boxes_on_hand} ${row.unit_name}${Number(row.boxes_on_hand) === 1 ? "" : "s"} left.`,
        url: `/stock?location=${locationId}`,
      });
    }
  } catch (err) {
    // never let a notification problem fail the record itself
    console.error("[records.alertLowStock]", err);
  }
}

// ---------------------------------------------------------------------------
// Sales
// ---------------------------------------------------------------------------
export async function createSale(payload: unknown): Promise<ActionResult> {
  const parsed = saleSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const input = parsed.data;

  const member = await requireLocationAccess(input.location_id);
  if (!member) return { ok: false, error: "You can only record for your own shop." };

  const supabase = await createClient();
  if (await alreadySaved(supabase, "sales", input.client_ref || undefined)) return { ok: true };

  // cost snapshots come from the product at sale time
  const productIds = input.items.map((i) => i.product_id);
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, cost_price, pieces_per_unit")
    .in("id", productIds);
  if (productsError || !products) {
    console.error("[records.createSale] products", productsError?.message);
    return { ok: false, error: "Could not load the products. Try again." };
  }
  // Guard BEFORE inserting the sale header — a stale product id (retired
  // mid-session) would otherwise throw after the insert and leave an orphan
  // sale with no items.
  if (input.items.some((i) => !products.some((p) => p.id === i.product_id))) {
    return { ok: false, error: "A product in this sale no longer exists. Refresh and try again." };
  }

  const { data: sale, error: saleError } = await supabase
    .from("sales")
    .insert({
      location_id: input.location_id,
      sale_date: input.sale_date,
      sale_type: input.sale_type,
      customer_name: input.customer_name || null,
      created_by: member.userId,
      client_ref: input.client_ref || null,
    })
    .select("id")
    .single();
  if (saleError) {
    console.error("[records.createSale] sale", saleError.message);
    return { ok: false, error: "Could not save the sale. Try again." };
  }

  const items = input.items.map((item) => {
    const product = products.find((p) => p.id === item.product_id)!;
    const unitCost =
      item.unit_level === "box"
        ? Number(product.cost_price)
        : Number(product.cost_price) / product.pieces_per_unit;
    return {
      sale_id: sale.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_level: item.unit_level,
      unit_price: item.unit_price,
      unit_cost: Math.round(unitCost * 100) / 100,
    };
  });

  const { error: itemsError } = await supabase.from("sale_items").insert(items);
  if (itemsError) {
    console.error("[records.createSale] items", itemsError.message);
    // undo the half-made sale so no phantom record remains
    await supabase.from("sales").update({ deleted_at: new Date().toISOString() }).eq("id", sale.id);
    return { ok: false, error: "Could not save the sale items. Try again." };
  }

  await logAction(supabase, member.userId, "sale.created", "sale", sale.id, {
    location_id: input.location_id,
    sale_type: input.sale_type,
    items: items.length,
  });
  await alertLowStock(supabase, input.location_id, productIds);
  revalidatePath("/home");
  revalidatePath("/today");
  revalidatePath("/dashboard");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------
export async function createExpense(formData: FormData): Promise<ActionResult> {
  const parsed = expenseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const input = parsed.data;

  const member = await requireLocationAccess(input.location_id);
  if (!member) return { ok: false, error: "You can only record for your own shop." };

  const supabase = await createClient();
  if (await alreadySaved(supabase, "expenses", input.client_ref || undefined)) return { ok: true };

  const { data, error } = await supabase
    .from("expenses")
    .insert({
      location_id: input.location_id,
      category: input.category,
      amount: input.amount,
      expense_date: input.expense_date,
      description: input.description || null,
      created_by: member.userId,
      client_ref: input.client_ref || null,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[records.createExpense]", error.message);
    return { ok: false, error: "Could not save it. Try again." };
  }

  await logAction(supabase, member.userId, "expense.created", "expense", data.id, {
    category: input.category,
    amount: input.amount,
  });
  revalidatePath("/home");
  revalidatePath("/today");
  revalidatePath("/dashboard");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Deliveries (stock arrived) — with optional pay-now
// ---------------------------------------------------------------------------
export async function createDelivery(payload: unknown): Promise<ActionResult> {
  const parsed = deliverySchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const input = parsed.data;
  const locationId = input.location_id || null; // null = Main store

  const member = await requireLocationAccess(locationId);
  if (!member) return { ok: false, error: "You can only record for your own shop." };

  const supabase = await createClient();
  const { data: delivery, error: deliveryError } = await supabase
    .from("deliveries")
    .insert({
      location_id: locationId,
      supplier_id: input.supplier_id,
      delivery_date: input.delivery_date,
      total_cost: input.total_cost,
      notes: input.notes || null,
      created_by: member.userId,
    })
    .select("id")
    .single();
  if (deliveryError) {
    console.error("[records.createDelivery]", deliveryError.message);
    return { ok: false, error: "Could not save the delivery. Try again." };
  }

  const { error: itemsError } = await supabase.from("delivery_items").insert(
    input.items.map((item) => ({
      delivery_id: delivery.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_cost: item.unit_cost,
      unit_wholesale_price: item.unit_wholesale_price,
    }))
  );
  if (itemsError) {
    console.error("[records.createDelivery] items", itemsError.message);
    await supabase.from("deliveries").update({ deleted_at: new Date().toISOString() }).eq("id", delivery.id);
    return { ok: false, error: "Could not save the delivery items. Try again." };
  }

  if (input.paid_now && input.paid_now > 0) {
    const { error: payError } = await supabase.from("supplier_payments").insert({
      supplier_id: input.supplier_id,
      delivery_id: delivery.id,
      amount: input.paid_now,
      paid_on: input.delivery_date,
      method: input.payment_method || null,
      created_by: member.userId,
    });
    if (payError) console.error("[records.createDelivery] payment", payError.message);
  }

  await logAction(supabase, member.userId, "delivery.created", "delivery", delivery.id, {
    supplier_id: input.supplier_id,
    total_cost: input.total_cost,
    paid_now: input.paid_now ?? 0,
    central: locationId === null,
  });
  revalidatePath("/home");
  revalidatePath("/today");
  revalidatePath("/suppliers");
  revalidatePath("/dashboard");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Losses (spoiled / lost stock)
// ---------------------------------------------------------------------------
export async function createLoss(formData: FormData): Promise<ActionResult> {
  const parsed = lossSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const input = parsed.data;

  const member = await requireLocationAccess(input.location_id);
  if (!member) return { ok: false, error: "You can only record for your own shop." };

  const supabase = await createClient();
  if (await alreadySaved(supabase, "stock_losses", input.client_ref || undefined)) return { ok: true };

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("cost_price, pieces_per_unit")
    .eq("id", input.product_id)
    .single();
  if (productError || !product) {
    return { ok: false, error: "Could not load the product. Try again." };
  }

  const unitCost =
    input.unit_level === "box"
      ? Number(product.cost_price)
      : Number(product.cost_price) / product.pieces_per_unit;

  const { data, error } = await supabase
    .from("stock_losses")
    .insert({
      location_id: input.location_id,
      product_id: input.product_id,
      quantity: input.quantity,
      unit_level: input.unit_level,
      unit_cost: Math.round(unitCost * 100) / 100,
      reason: input.reason,
      loss_date: input.loss_date,
      created_by: member.userId,
      client_ref: input.client_ref || null,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[records.createLoss]", error.message);
    return { ok: false, error: "Could not save it. Try again." };
  }

  await logAction(supabase, member.userId, "loss.created", "stock_loss", data.id, {
    product_id: input.product_id,
    quantity: input.quantity,
    reason: input.reason,
  });
  await alertLowStock(supabase, input.location_id, [input.product_id]);
  revalidatePath("/home");
  revalidatePath("/today");
  revalidatePath("/dashboard");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Stock distributions — owners send stock from Main store to shops
// ---------------------------------------------------------------------------
export async function createDistribution(payload: unknown): Promise<ActionResult> {
  const parsed = distributionSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const input = parsed.data;

  const member = await getSessionMember();
  if (!member || member.role === "manager") {
    return { ok: false, error: "Only owners can send stock to shops." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("stock_distributions").insert(
    input.items.map((item) => ({
      location_id: input.location_id,
      product_id: item.product_id,
      quantity: item.quantity,
      distribution_date: input.distribution_date,
      created_by: member.userId,
    }))
  );
  if (error) {
    console.error("[records.createDistribution]", error.message);
    return { ok: false, error: "Could not send the stock. Try again." };
  }

  await logAction(supabase, member.userId, "distribution.created", "stock_distribution", null, {
    location_id: input.location_id,
    items: input.items.length,
  });
  revalidatePath("/distribute");
  revalidatePath("/stock");
  revalidatePath("/home");
  revalidatePath("/dashboard");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Supplier payments (from supplier detail screen)
// ---------------------------------------------------------------------------
export async function addSupplierPayment(formData: FormData): Promise<ActionResult> {
  const parsed = supplierPaymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const input = parsed.data;

  const member = await getSessionMember();
  if (!member) return { ok: false, error: "You are signed out. Sign in again." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("supplier_payments")
    .insert({
      supplier_id: input.supplier_id,
      delivery_id: input.delivery_id || null,
      amount: input.amount,
      paid_on: input.paid_on,
      method: input.method || null,
      created_by: member.userId,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[records.addSupplierPayment]", error.message);
    return { ok: false, error: "Could not record the payment. Try again." };
  }

  await logAction(supabase, member.userId, "supplier_payment.created", "supplier_payment", data.id, {
    supplier_id: input.supplier_id,
    amount: input.amount,
  });
  revalidatePath("/suppliers");
  revalidatePath("/dashboard");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Soft delete a record (RLS: managers only their own, same day; owners always)
// ---------------------------------------------------------------------------
const DELETABLE = new Set(["sales", "expenses", "stock_losses", "deliveries"]);

export async function softDeleteRecord(table: string, id: string): Promise<ActionResult> {
  if (!DELETABLE.has(table)) return { ok: false, error: "This cannot be removed." };

  const member = await getSessionMember();
  if (!member) return { ok: false, error: "You are signed out. Sign in again." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from(table)
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id");
  if (error || !data?.length) {
    console.error("[records.softDeleteRecord]", table, error?.message ?? "no row updated");
    return { ok: false, error: "Could not remove it — records can only be removed on the day they were made." };
  }

  await logAction(supabase, member.userId, `${table}.removed`, table, id);
  revalidatePath("/today");
  revalidatePath("/home");
  revalidatePath("/dashboard");
  return { ok: true };
}
