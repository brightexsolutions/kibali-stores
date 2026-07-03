import type { Business, Product } from "@kibali/shared";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ProductsManager } from "./products-manager";

export default async function ProductsPage() {
  await requireOwner();
  const supabase = await createClient();

  const [{ data: businesses }, { data: products }] = await Promise.all([
    supabase.from("businesses").select("id, name").is("deleted_at", null).order("name"),
    supabase
      .from("products")
      .select(
        "id, business_id, name, unit_name, piece_name, pieces_per_unit, cost_price, wholesale_price, retail_price_per_piece, low_stock_threshold, reorder_buffer_days, is_active"
      )
      .is("deleted_at", null)
      .order("name"),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Products & Prices</h1>
        <p className="text-sm text-muted-foreground">
          Each product sells as whole {`boxes (wholesale)`} or single pieces (retail).
        </p>
      </div>
      <ProductsManager
        businesses={(businesses ?? []) as Business[]}
        products={(products ?? []) as Product[]}
      />
    </div>
  );
}
