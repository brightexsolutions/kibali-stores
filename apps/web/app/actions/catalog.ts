"use server";

import { revalidatePath } from "next/cache";
import {
  businessSchema,
  locationSchema,
  productSchema,
  supplierSchema,
  type ActionResult,
} from "@kibali/shared";
import { getSessionMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/audit";
import { provisionShopLogin, resetShopLoginPassword, type ShopLoginCredentials } from "@/lib/shop-login";
import { createAdminClient } from "@/lib/supabase/admin";

/** A closed shop's accounts (shop login or personal manager) must not keep access. */
async function deactivateLocationMembers(locationIds: string[]) {
  if (locationIds.length === 0) return;
  const admin = createAdminClient();
  const { error } = await admin
    .from("members")
    .update({ is_active: false })
    .in("location_id", locationIds)
    .eq("role", "manager");
  if (error) console.error("[catalog.deactivateLocationMembers]", error.message);
}

async function requireOwnerAction() {
  const member = await getSessionMember();
  if (!member || member.role === "manager") return null;
  return member;
}

function firstIssue(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Check the form and try again.";
}

// ---------- businesses ----------
export async function saveBusiness(
  formData: FormData,
  id?: string
): Promise<ActionResult> {
  const member = await requireOwnerAction();
  if (!member) return { ok: false, error: "Only owners can do this." };

  const parsed = businessSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const values = { name: parsed.data.name, description: parsed.data.description || null };

  const { data, error } = id
    ? await supabase.from("businesses").update(values).eq("id", id).select("id").single()
    : await supabase.from("businesses").insert(values).select("id").single();

  if (error) {
    console.error("[catalog.saveBusiness]", error.message);
    return { ok: false, error: "Could not save the business. Try again." };
  }

  await logAction(supabase, member.userId, id ? "business.updated" : "business.created", "business", data.id, values);
  revalidatePath("/settings");
  return { ok: true };
}

// ---------- locations ----------
export async function saveLocation(
  formData: FormData,
  id?: string
): Promise<ActionResult<{ id: string; shopLogin?: ShopLoginCredentials }>> {
  const member = await requireOwnerAction();
  if (!member) return { ok: false, error: "Only owners can do this." };

  const parsed = locationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const values = {
    business_id: parsed.data.business_id,
    name: parsed.data.name,
    monthly_rent: parsed.data.monthly_rent || null,
  };

  const { data, error } = id
    ? await supabase.from("locations").update(values).eq("id", id).select("id").single()
    : await supabase.from("locations").insert(values).select("id").single();

  if (error) {
    console.error("[catalog.saveLocation]", error.message);
    return { ok: false, error: "Could not save the shop. Try again." };
  }

  await logAction(supabase, member.userId, id ? "location.updated" : "location.created", "location", data.id, values);

  // Every new shop gets its own login (code + temp password shown once).
  // A failure here doesn't fail the shop — /settings offers a retry button.
  let shopLogin: ShopLoginCredentials | undefined;
  if (!id) {
    const result = await provisionShopLogin({ id: data.id, name: values.name });
    if ("credentials" in result) {
      shopLogin = result.credentials;
      await logAction(supabase, member.userId, "shop_login.created", "member", result.userId, {
        location_id: data.id,
        code: result.credentials.code,
      });
    }
  }

  revalidatePath("/settings");
  return { ok: true, data: { id: data.id, shopLogin } };
}

/** Create a shop login for an existing shop that doesn't have one yet. */
export async function createShopLogin(
  locationId: string
): Promise<ActionResult<ShopLoginCredentials>> {
  const member = await requireOwnerAction();
  if (!member) return { ok: false, error: "Only owners can do this." };

  const supabase = await createClient();
  const { data: location } = await supabase
    .from("locations")
    .select("id, name")
    .eq("id", locationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!location) return { ok: false, error: "That shop no longer exists." };

  const result = await provisionShopLogin(location);
  if ("error" in result) return { ok: false, error: result.error };

  await logAction(supabase, member.userId, "shop_login.created", "member", result.userId, {
    location_id: locationId,
    code: result.credentials.code,
  });
  revalidatePath("/settings");
  revalidatePath("/team");
  return { ok: true, data: result.credentials };
}

/** Reset an existing shop login to a fresh memorable password. */
export async function resetShopLogin(
  locationId: string
): Promise<ActionResult<ShopLoginCredentials>> {
  const member = await requireOwnerAction();
  if (!member) return { ok: false, error: "Only owners can do this." };

  const result = await resetShopLoginPassword(locationId);
  if ("error" in result) return { ok: false, error: result.error };

  const supabase = await createClient();
  await logAction(supabase, member.userId, "shop_login.password_reset", "member", result.userId, {
    location_id: locationId,
    code: result.credentials.code,
  });
  revalidatePath("/settings");
  return { ok: true, data: result.credentials };
}

/** Soft delete — the shop and all its history stay in the database, just hidden from active lists. */
export async function deleteLocation(id: string): Promise<ActionResult> {
  const member = await requireOwnerAction();
  if (!member) return { ok: false, error: "Only owners can do this." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("locations")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    console.error("[catalog.deleteLocation]", error.message);
    return { ok: false, error: "Could not remove the shop. Try again." };
  }

  await deactivateLocationMembers([id]);
  await logAction(supabase, member.userId, "location.deleted", "location", id);
  revalidatePath("/settings");
  return { ok: true };
}

/** Soft delete — cascades to the business's own shops so nothing is left orphaned in the active UI. Records stay intact. */
export async function deleteBusiness(id: string): Promise<ActionResult> {
  const member = await requireOwnerAction();
  if (!member) return { ok: false, error: "Only owners can do this." };

  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data: deletedLocs, error: locError } = await supabase
    .from("locations")
    .update({ deleted_at: now })
    .eq("business_id", id)
    .is("deleted_at", null)
    .select("id");
  if (locError) {
    console.error("[catalog.deleteBusiness] locations", locError.message);
    return { ok: false, error: "Could not remove the business's shops. Try again." };
  }
  await deactivateLocationMembers((deletedLocs ?? []).map((l) => l.id));

  const { error } = await supabase.from("businesses").update({ deleted_at: now }).eq("id", id);
  if (error) {
    console.error("[catalog.deleteBusiness]", error.message);
    return { ok: false, error: "Could not remove the business. Try again." };
  }

  await logAction(supabase, member.userId, "business.deleted", "business", id);
  revalidatePath("/settings");
  return { ok: true };
}

// ---------- suppliers ----------
export async function saveSupplier(
  formData: FormData,
  id?: string
): Promise<ActionResult<{ id: string }>> {
  const member = await requireOwnerAction();
  if (!member) return { ok: false, error: "Only owners can do this." };

  const parsed = supplierSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const values = {
    business_id: parsed.data.business_id,
    name: parsed.data.name,
    phone: parsed.data.phone || null,
    notes: parsed.data.notes || null,
  };

  const { data, error } = id
    ? await supabase.from("suppliers").update(values).eq("id", id).select("id").single()
    : await supabase.from("suppliers").insert(values).select("id").single();

  if (error) {
    console.error("[catalog.saveSupplier]", error.message);
    return { ok: false, error: "Could not save the supplier. Try again." };
  }

  await logAction(supabase, member.userId, id ? "supplier.updated" : "supplier.created", "supplier", data.id, values);
  revalidatePath("/suppliers");
  return { ok: true, data: { id: data.id } };
}

// ---------- products ----------
export async function saveProduct(
  formData: FormData,
  id?: string
): Promise<ActionResult> {
  const member = await requireOwnerAction();
  if (!member) return { ok: false, error: "Only owners can do this." };

  const parsed = productSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { data, error } = id
    ? await supabase.from("products").update(parsed.data).eq("id", id).select("id").single()
    : await supabase.from("products").insert(parsed.data).select("id").single();

  if (error) {
    console.error("[catalog.saveProduct]", error.message);
    return { ok: false, error: "Could not save the product. Try again." };
  }

  await logAction(supabase, member.userId, id ? "product.updated" : "product.created", "product", data.id, parsed.data);
  revalidatePath("/products");
  return { ok: true };
}

export async function setProductActive(id: string, active: boolean): Promise<ActionResult> {
  const member = await requireOwnerAction();
  if (!member) return { ok: false, error: "Only owners can do this." };

  const supabase = await createClient();
  const { error } = await supabase.from("products").update({ is_active: active }).eq("id", id);
  if (error) {
    console.error("[catalog.setProductActive]", error.message);
    return { ok: false, error: "Could not update the product." };
  }

  await logAction(supabase, member.userId, active ? "product.activated" : "product.retired", "product", id);
  revalidatePath("/products");
  return { ok: true };
}
