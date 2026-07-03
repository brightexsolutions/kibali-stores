"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import type { Business, Supplier, SupplierBalance } from "@kibali/shared";
import { formatKES } from "@kibali/shared";
import { AdminTable, Td } from "@/components/ui/admin-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { saveSupplier } from "@/app/actions/catalog";

export function SuppliersManager({
  businesses,
  suppliers,
  balances,
}: {
  businesses: Business[];
  suppliers: Supplier[];
  balances: SupplierBalance[];
}) {
  const router = useRouter();
  const [modal, setModal] = useState<{ current?: Supplier } | null>(null);
  const [pending, startTransition] = useTransition();

  const balanceOf = (id: string) => balances.find((b) => b.supplier_id === id);
  const businessName = (id: string) => businesses.find((b) => b.id === id)?.name ?? "—";

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await saveSupplier(form, modal?.current?.id);
      if (!result.ok) return void toast.error(result.error);
      toast.success("Supplier saved.");
      setModal(null);
      router.refresh();
    });
  }

  return (
    <>
      <Button size="lg" onClick={() => setModal({})}>
        <Plus className="h-5 w-5" /> Add a supplier
      </Button>

      {suppliers.length === 0 ? (
        <p className="rounded border bg-background p-6 text-center text-muted-foreground">
          No suppliers yet — add the first one above.
        </p>
      ) : (
        <AdminTable headers={["Supplier", "Business", "Delivered", "Paid", "Still owed", ""]}>
          {suppliers.map((s) => {
            const bal = balanceOf(s.id);
            const owed = bal?.balance_owed ?? 0;
            return (
              <tr key={s.id}>
                <Td className="font-medium">
                  <Link href={`/suppliers/${s.id}`} className="text-primary underline-offset-2 hover:underline">
                    {s.name}
                  </Link>
                  {s.phone && <div className="text-xs text-muted-foreground">{s.phone}</div>}
                </Td>
                <Td>{businessName(s.business_id)}</Td>
                <Td>{formatKES(bal?.total_delivered ?? 0)}</Td>
                <Td>{formatKES(bal?.total_paid ?? 0)}</Td>
                <Td>
                  {owed > 0 ? (
                    <Badge variant="warn">{formatKES(owed)}</Badge>
                  ) : (
                    <Badge variant="good">Nothing owed</Badge>
                  )}
                </Td>
                <Td>
                  <Button variant="ghost" size="sm" onClick={() => setModal({ current: s })}>
                    Edit
                  </Button>
                </Td>
              </tr>
            );
          })}
        </AdminTable>
      )}

      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal?.current ? "Edit supplier" : "New supplier"}
      >
        {modal && (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="s-biz">Business they supply</Label>
              <Select id="s-biz" name="business_id" defaultValue={modal.current?.business_id} required>
                <option value="">Choose a business…</option>
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="s-name">Supplier name</Label>
              <Input id="s-name" name="name" defaultValue={modal.current?.name} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="s-phone">Phone (optional)</Label>
              <Input id="s-phone" name="phone" inputMode="tel" defaultValue={modal.current?.phone ?? ""} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="s-notes">Notes (optional)</Label>
              <Textarea id="s-notes" name="notes" defaultValue={modal.current?.notes ?? ""} />
            </div>
            <Button type="submit" size="lg" disabled={pending} loading={pending}>
              {pending ? "Saving…" : "Save supplier"}
            </Button>
          </form>
        )}
      </Modal>
    </>
  );
}
