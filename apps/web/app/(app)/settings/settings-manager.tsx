"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, KeyRound, Plus, Pencil, RotateCcw, Store, Trash2 } from "lucide-react";
import type { Business, Location } from "@kibali/shared";
import { formatKES } from "@kibali/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  createShopLogin,
  deleteBusiness,
  deleteLocation,
  resetShopLogin,
  saveBusiness,
  saveLocation,
} from "@/app/actions/catalog";

type BusinessModal = { kind: "business"; current?: Business };
type LocationModal = { kind: "location"; businessId: string; current?: Location };
type ShopCredentials = { shopName: string; code: string; tempPassword: string };

export function SettingsManager({
  businesses,
  locations,
  shopCodes,
}: {
  businesses: Business[];
  locations: Location[];
  /** location_id -> shop-login code, for shops that already have one */
  shopCodes: Record<string, string>;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [modal, setModal] = useState<BusinessModal | LocationModal | null>(null);
  const [credentials, setCredentials] = useState<ShopCredentials | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!modal) return;
    const form = new FormData(e.currentTarget);
    const shopName = String(form.get("name") ?? "");
    startTransition(async () => {
      const result =
        modal.kind === "business"
          ? await saveBusiness(form, modal.current?.id)
          : await saveLocation(form, modal.current?.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setModal(null);
      router.refresh();
      // New shop → show its login exactly once.
      const shopLogin =
        modal.kind === "location" && result.data && "shopLogin" in result.data
          ? result.data.shopLogin
          : undefined;
      if (shopLogin) {
        setCredentials({ shopName, ...shopLogin });
      } else {
        toast.success("Saved.");
      }
    });
  }

  function addShopLogin(l: Location) {
    startTransition(async () => {
      const result = await createShopLogin(l.id);
      if (!result.ok) return void toast.error(result.error);
      setCredentials({ shopName: l.name, ...result.data! });
      router.refresh();
    });
  }

  async function resetLogin(l: Location) {
    const okReset = await confirm({
      title: `Reset password for ${l.name}?`,
      message: "A new easy-to-remember password is created and the old one stops working right away.",
      confirmLabel: "Reset password",
    });
    if (!okReset) return;
    startTransition(async () => {
      const result = await resetShopLogin(l.id);
      if (!result.ok) return void toast.error(result.error);
      setCredentials({ shopName: l.name, ...result.data! });
      router.refresh();
    });
  }

  async function removeBusiness(b: Business) {
    const okDelete = await confirm({
      title: `Remove ${b.name}?`,
      message: "This business and all its shops disappear from your active lists. Past records stay safe.",
      confirmLabel: "Remove",
      destructive: true,
    });
    if (!okDelete) return;
    startTransition(async () => {
      const result = await deleteBusiness(b.id);
      if (!result.ok) return void toast.error(result.error);
      toast.success("Business removed.");
      router.refresh();
    });
  }

  async function removeLocation(l: Location) {
    const okDelete = await confirm({
      title: `Remove ${l.name}?`,
      message: "This shop disappears from your active lists. Past records stay safe.",
      confirmLabel: "Remove",
      destructive: true,
    });
    if (!okDelete) return;
    startTransition(async () => {
      const result = await deleteLocation(l.id);
      if (!result.ok) return void toast.error(result.error);
      toast.success("Shop removed.");
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
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Edit ${b.name}`}
                  onClick={() => setModal({ kind: "business", current: b })}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${b.name}`}
                  disabled={pending}
                  onClick={() => removeBusiness(b)}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {shops.map((l) => (
                <div key={l.id} className="rounded border bg-background p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <Store className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <div className="truncate font-medium">{l.name}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {shopCodes[l.id] ? `Login code: ${shopCodes[l.id]}` : "No shop login yet"}
                        </div>
                      </div>
                    </div>
                    <span className="shrink-0 text-sm text-muted-foreground">
                      {l.monthly_rent ? `Rent ${formatKES(l.monthly_rent)}/mo` : "No rent"}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setModal({ kind: "location", businessId: b.id, current: l })}
                    >
                      <Pencil className="h-4 w-4" /> Edit
                    </Button>
                    {shopCodes[l.id] ? (
                      <Button variant="ghost" size="sm" disabled={pending} onClick={() => resetLogin(l)}>
                        <RotateCcw className="h-4 w-4" /> Reset password
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" disabled={pending} onClick={() => addShopLogin(l)}>
                        <KeyRound className="h-4 w-4 text-primary" /> Create login
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      disabled={pending}
                      onClick={() => removeLocation(l)}
                    >
                      <Trash2 className="h-4 w-4" /> Remove
                    </Button>
                  </div>
                </div>
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
            <Button type="submit" size="lg" disabled={pending} loading={pending}>
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
              <Input id="l-name" name="name" defaultValue={modal.current?.name} placeholder="e.g. Migori Shop" required />
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
            <Button type="submit" size="lg" disabled={pending} loading={pending}>
              {pending ? "Saving…" : "Save shop"}
            </Button>
          </form>
        )}
      </Modal>

      <Modal
        open={!!credentials}
        onClose={() => setCredentials(null)}
        title={credentials ? `Login for ${credentials.shopName}` : ""}
      >
        {credentials && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Share these with the person running this shop. They sign in with the shop
              code (no email needed) and keep using this password — no change needed.
              <strong> It&apos;s shown only once here, but you can reset it any time from this page.</strong>
            </p>
            <div className="flex flex-col gap-2 rounded border bg-muted/50 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">Shop code</span>
                <span className="font-mono font-semibold">{credentials.code}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">Password</span>
                <span className="font-mono font-semibold">{credentials.tempPassword}</span>
              </div>
            </div>
            <Button
              size="lg"
              onClick={() => {
                navigator.clipboard.writeText(
                  `Shop code: ${credentials.code}\nPassword: ${credentials.tempPassword}`
                );
                toast.success("Copied — paste it to the shop's phone.");
              }}
            >
              <Copy className="h-4 w-4" /> Copy both
            </Button>
          </div>
        )}
      </Modal>
    </>
  );
}
