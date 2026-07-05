import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendToOwners } from "@/lib/push";

/**
 * Evening check, called by cron-job.com (like /api/health) once a day around
 * closing time (e.g. 20:00 EAT):
 *   - which shops recorded nothing today (no sales AND no expenses)
 *   - which products are flagged "order soon"
 * Sends ONE summary push to every owner/super-admin device. Secured by the
 * CRON_SECRET env var: /api/cron/daily-check?key=<secret>
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const key = request.nextUrl.searchParams.get("key");
  if (!secret || key !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const [locationsRes, salesRes, expensesRes, reorderRes] = await Promise.all([
    admin.from("locations").select("id, name").is("deleted_at", null),
    admin.from("sales").select("location_id").eq("sale_date", today).is("deleted_at", null),
    admin.from("expenses").select("location_id").eq("expense_date", today).is("deleted_at", null),
    admin.from("v_reorder_status").select("product_name, location_id").eq("order_soon", true),
  ]);

  const locations = locationsRes.data ?? [];
  const recorded = new Set([
    ...(salesRes.data ?? []).map((s) => s.location_id),
    ...(expensesRes.data ?? []).map((e) => e.location_id),
  ]);
  const locationName = new Map(locations.map((l) => [l.id, l.name] as const));

  const silentShops = locations.filter((l) => !recorded.has(l.id)).map((l) => l.name);
  const orderSoon = (reorderRes.data ?? []).map(
    (r) => `${r.product_name} (${locationName.get(r.location_id) ?? "Main store"})`
  );

  const lines: string[] = [];
  if (silentShops.length > 0) lines.push(`No records today: ${silentShops.join(", ")}.`);
  if (orderSoon.length > 0) lines.push(`Order soon: ${orderSoon.slice(0, 5).join(", ")}${orderSoon.length > 5 ? "…" : ""}.`);

  if (lines.length > 0) {
    await sendToOwners({
      title: "Kibali evening check",
      body: lines.join(" "),
      url: silentShops.length > 0 ? "/dashboard" : "/stock?location=all",
    });
  }

  return NextResponse.json({
    status: "ok",
    date: today,
    silentShops,
    orderSoon: orderSoon.length,
    notified: lines.length > 0,
  });
}
