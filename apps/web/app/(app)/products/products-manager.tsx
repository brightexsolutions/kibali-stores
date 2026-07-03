"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import type { Business, Product } from "@kibali/shared";
import { formatKES } from "@kibali/shared";
import { AdminTable, Td } from "@/components/ui/admin-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { saveProduct, setProductActive } from "@/app/actions/catalog";

export function ProductsManager({
  businesses,
  products,
}: {
  businesses: Business[];
  products: Product[];
}) {
  const router = useRouter();
  const [modal, setModal] = useState<{ current?: Product } | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await saveProduct(form, modal?.current?.id);
      if (!result.ok) return void toast.error(result.error);
      toast.success("Product saved.");
      setModal(null);
      router.refresh();
    });
  }

  function toggleActive(p: Product) {
    startTransition(async () => {
      const result = await setProductActive(p.id, !p.is_active);
      if (!result.ok) return void toast.error(result.error);
      toast.success(p.is_active ? "Product retired." : "Product active again.");
      router.refresh();
    });
  }

  const businessName = (id: string) => businesses.find((b) => b.id === id)?.name ?? "—";

  return (
    <>
      <Button size="lg" onClick={() => setModal({})}>
        <Plus className="h-5 w-5" /> Add a product
      </Button>

      {products.length === 0 ? (
        <p className="rounded border bg-background p-6 text-center text-muted-foreground">
          No products yet — add the first one above.
        </p>
      ) : (
        <AdminTable
          headers={["Product", "Business", "Box", "Cost/box", "Sell/box", "Sell/piece", "Status", ""]}
        >
          {products.map((p) => (
            <tr key={p.id} className={p.is_active ? "" : "opacity-50"}>
              <Td className="font-medium">{p.name}</Td>
              <Td>{businessName(p.business_id)}</Td>
              <Td>
                {p.pieces_per_unit} {p.piece_name}s
              </Td>
              <Td>{formatKES(p.cost_price)}</Td>
              <Td>{formatKES(p.wholesale_price)}</Td>
              <Td>{formatKES(p.retail_price_per_piece)}</Td>
              <Td>
                <Badge variant={p.is_active ? "good" : "muted"}>
                  {p.is_active ? "Selling" : "Retired"}
                </Badge>
              </Td>
              <Td className="whitespace-nowrap">
                <Button variant="ghost" size="sm" onClick={() => setModal({ current: p })}>
                  Edit
                </Button>
                <Button variant="ghost" size="sm" disabled={pending} onClick={() => toggleActive(p)}>
                  {p.is_active ? "Retire" : "Activate"}
                </Button>
              </Td>
            </tr>
          ))}
        </AdminTable>
      )}

      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal?.current ? "Edit product" : "New product"}
      >
        {modal && (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-biz">Business</Label>
              <Select id="p-biz" name="business_id" defaultValue={modal.current?.business_id} required>
                <option value="">Choose a business…</option>
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-name">Product name</Label>
              <Input id="p-name" name="name" defaultValue={modal.current?.name} placeholder="Ice Pop (10 bob)" required />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="p-unit">Sold in</Label>
                <Input id="p-unit" name="unit_name" defaultValue={modal.current?.unit_name ?? "box"} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="p-piece">One piece is</Label>
                <Input id="p-piece" name="piece_name" defaultValue={modal.current?.piece_name ?? "piece"} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="p-ppu">Pieces per box</Label>
                <Input id="p-ppu" name="pieces_per_unit" type="number" inputMode="numeric" min={1} defaultValue={modal.current?.pieces_per_unit ?? 1} required />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="p-cost">Usual cost per box</Label>
                <Input id="p-cost" name="cost_price" type="number" inputMode="decimal" min={0} step="0.01" defaultValue={modal.current?.cost_price ?? ""} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="p-ws">Sell per box</Label>
                <Input id="p-ws" name="wholesale_price" type="number" inputMode="decimal" min={0} step="0.01" defaultValue={modal.current?.wholesale_price ?? ""} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="p-rt">Sell per piece</Label>
                <Input id="p-rt" name="retail_price_per_piece" type="number" inputMode="decimal" min={0} step="0.01" defaultValue={modal.current?.retail_price_per_piece ?? ""} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="p-low">Warn when boxes left ≤</Label>
                <Input id="p-low" name="low_stock_threshold" type="number" inputMode="numeric" min={0} defaultValue={modal.current?.low_stock_threshold ?? 10} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="p-buffer">Order lead time (days)</Label>
                <Input id="p-buffer" name="reorder_buffer_days" type="number" inputMode="numeric" min={1} defaultValue={modal.current?.reorder_buffer_days ?? 3} required />
              </div>
            </div>
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? "Saving…" : "Save product"}
            </Button>
          </form>
        )}
      </Modal>
    </>
  );
}
