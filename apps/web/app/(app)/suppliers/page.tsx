import type { Business, Supplier, SupplierBalance } from "@kibali/shared";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SuppliersManager } from "./suppliers-manager";

export default async function SuppliersPage() {
  await requireOwner();
  const supabase = await createClient();

  const [{ data: businesses }, { data: suppliers }, { data: balances }] = await Promise.all([
    supabase.from("businesses").select("id, name").is("deleted_at", null).order("name"),
    supabase
      .from("suppliers")
      .select("id, business_id, name, phone, notes")
      .is("deleted_at", null)
      .order("name"),
    supabase.from("v_supplier_balances").select("*"),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Suppliers</h1>
        <p className="text-sm text-muted-foreground">
          Who supplies the stock, and what is still owed to them.
        </p>
      </div>
      <SuppliersManager
        businesses={(businesses ?? []) as Business[]}
        suppliers={(suppliers ?? []) as Supplier[]}
        balances={(balances ?? []) as SupplierBalance[]}
      />
    </div>
  );
}
