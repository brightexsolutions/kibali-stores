import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import type { StockLevel } from "@kibali/shared";
import { requireMember } from "@/lib/auth";
import { resolveLocation } from "@/lib/location";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { LocationPicker } from "@/components/location-picker";

function StockRow({ s }: { s: StockLevel }) {
  const low = Number(s.boxes_on_hand) <= s.low_stock_threshold;
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-3">
        <div>
          <div className="font-semibold">{s.product_name}</div>
          <div className="text-sm text-muted-foreground">
            <strong className="text-foreground">
              {s.boxes_on_hand} {s.unit_name}
              {Number(s.boxes_on_hand) === 1 ? "" : "s"}
            </strong>
            {Number(s.loose_pieces) > 0 && (
              <> + {s.loose_pieces} loose {s.piece_name}s</>
            )}{" "}
            left
          </div>
        </div>
        {low && <Badge variant="bad">Low — order soon</Badge>}
      </CardContent>
    </Card>
  );
}

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<{ location?: string }>;
}) {
  const member = await requireMember();
  const { location: locationParam } = await searchParams;
  const supabase = await createClient();
  const { location, all } = await resolveLocation(member, locationParam);
  if (!location && member.role === "manager") redirect("/home");

  // "All shops" — combined view, grouped by shop, owner/super_admin only.
  // Also the default when an owner is in the general environment (nothing
  // picked anywhere): show everything rather than guessing one shop.
  const showAll =
    member.role !== "manager" &&
    (locationParam === "all" || (!location && locationParam !== "main"));

  if (showAll) {
    const { data } = await supabase.from("v_stock_levels").select("*").order("product_name");
    const stock = (data ?? []) as StockLevel[];
    const byLocation = new Map<string, StockLevel[]>();
    for (const s of stock) {
      if (!s.location_id) continue; // Main store shown separately below
      byLocation.set(s.location_id, [...(byLocation.get(s.location_id) ?? []), s]);
    }
    const mainStoreStock = stock.filter((s) => !s.location_id);

    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Link href="/dashboard" aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold">What&apos;s in Stock</h1>
            <p className="text-sm text-muted-foreground">All shops combined</p>
          </div>
        </div>

        <LocationPicker locations={all} selectedId="all" allowMainStore allowAll />

        {all.map((l) => {
          const rows = byLocation.get(l.id) ?? [];
          return (
            <section key={l.id} className="flex flex-col gap-2">
              <h2 className="font-semibold">
                {l.name} <span className="font-normal text-muted-foreground">— {l.business_name}</span>
              </h2>
              {rows.length === 0 ? (
                <p className="rounded border bg-background p-4 text-sm text-muted-foreground">No stock here yet.</p>
              ) : (
                rows.map((s) => <StockRow key={s.product_id} s={s} />)
              )}
            </section>
          );
        })}

        {mainStoreStock.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="font-semibold">Main store</h2>
            {mainStoreStock.map((s) => (
              <StockRow key={s.product_id} s={s} />
            ))}
          </section>
        )}
      </div>
    );
  }

  let query = supabase.from("v_stock_levels").select("*").order("product_name");
  query = location ? query.eq("location_id", location.id) : query.is("location_id", null);
  const { data } = await query;
  const stock = (data ?? []) as StockLevel[];

  const q = location && member.role !== "manager" ? `?location=${location.id}` : "";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Link href={`/home${q}`} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold">What&apos;s in Stock</h1>
          <p className="text-sm text-muted-foreground">
            {location ? `${location.name} — ${location.business_name}` : "Main store (not yet sent to shops)"}
          </p>
        </div>
      </div>

      {member.role !== "manager" && (
        <LocationPicker locations={all} selectedId={location?.id ?? "main"} allowMainStore allowAll />
      )}

      {stock.length === 0 ? (
        <p className="rounded border bg-background p-6 text-center text-muted-foreground">
          No stock here yet — record a delivery when stock arrives.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {stock.map((s) => (
            <StockRow key={`${s.location_id}-${s.product_id}`} s={s} />
          ))}
        </div>
      )}
    </div>
  );
}
