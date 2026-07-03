"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Store } from "lucide-react";
import type { Business, Location } from "@kibali/shared";
import { formatKES } from "@kibali/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { saveBusiness, saveLocation } from "@/app/actions/catalog";

type BusinessModal = { kind: "business"; current?: Business };
type LocationModal = { kind: "location"; businessId: string; current?: Location };

export function SettingsManager({
  businesses,
  locations,
}: {
  businesses: Business[];
  locations: Location[];
}) {
  const router = useRouter();
  const [modal, setModal] = useState<BusinessModal | LocationModal | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!modal) return;
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const result =
        modal.kind === "business"
          ? await saveBusiness(form, modal.current?.id)
          : await saveLocation(form, modal.current?.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Saved.");
      setModal(null);
      router.refresh();
    });
  }

  return (
    <>
      {businesses.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            No businesses yet — start by adding your first one.
          </CardContent>
        </Card>
      )}

      {businesses.map((b) => {
        const shops = locations.filter((l) => l.business_id === b.id);
        return (
          <Card key={b.id}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>{b.name}</CardTitle>
                {b.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{b.description}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Edit ${b.name}`}
                onClick={() => setModal({ kind: "business", current: b })}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {shops.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setModal({ kind: "location", businessId: b.id, current: l })}
                  className="flex items-center justify-between rounded border bg-background p-3 text-left hover:bg-muted"
                >
                  <span className="flex items-center gap-2 font-medium">
                    <Store className="h-4 w-4 text-muted-foreground" />
                    {l.name}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {l.monthly_rent ? `Rent ${formatKES(l.monthly_rent)}/month` : "No rent set"}
                  </span>
                </button>
              ))}
              <Button
                variant="outline"
                onClick={() => setModal({ kind: "location", businessId: b.id })}
              >
                <Plus className="h-4 w-4" /> Add a shop
              </Button>
            </CardContent>
          </Card>
        );
      })}

      <Button size="lg" onClick={() => setModal({ kind: "business" })}>
        <Plus className="h-5 w-5" /> Add a business
      </Button>

      <Modal
        open={modal?.kind === "business"}
        onClose={() => setModal(null)}
        title={modal?.kind === "business" && modal.current ? "Edit business" : "New business"}
      >
        {modal?.kind === "business" && (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="b-name">Business name</Label>
              <Input id="b-name" name="name" defaultValue={modal.current?.name} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="b-desc">What does it sell? (optional)</Label>
              <Textarea id="b-desc" name="description" defaultValue={modal.current?.description ?? ""} />
            </div>
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? "Saving…" : "Save business"}
            </Button>
          </form>
        )}
      </Modal>

      <Modal
        open={modal?.kind === "location"}
        onClose={() => setModal(null)}
        title={modal?.kind === "location" && modal.current ? "Edit shop" : "New shop"}
      >
        {modal?.kind === "location" && (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <input type="hidden" name="business_id" value={modal.businessId} />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="l-name">Shop name</Label>
              <Input id="l-name" name="name" defaultValue={modal.current?.name} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="l-rent">Monthly rent in KSh (optional)</Label>
              <Input
                id="l-rent"
                name="monthly_rent"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                defaultValue={modal.current?.monthly_rent ?? ""}
              />
            </div>
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? "Saving…" : "Save shop"}
            </Button>
          </form>
        )}
      </Modal>
    </>
  );
}
