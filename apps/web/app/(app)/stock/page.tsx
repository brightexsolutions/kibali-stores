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

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<{ location?: string }>;
}) {
  const member = await requireMember();
  const { location: locationParam } = await searchParams;
  const { location, all } = await resolveLocation(member, locationParam);
  if (!location && member.role === "manager") redirect("/home");

  const supabase = await createClient();
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
        <LocationPicker locations={all} selectedId={location?.id} allowMainStore />
      )}

      {stock.length === 0 ? (
        <p className="rounded border bg-background p-6 text-center text-muted-foreground">
          No stock here yet — record a delivery when stock arrives.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {stock.map((s) => {
            const low = Number(s.boxes_on_hand) <= s.low_stock_threshold;
            return (
              <Card key={`${s.location_id}-${s.product_id}`}>
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
          })}
        </div>
      )}
    </div>
  );
}
