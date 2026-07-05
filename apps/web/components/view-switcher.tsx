"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Globe, Loader2, Store } from "lucide-react";
import type { LocationWithBusiness } from "@/lib/location";
import { setViewCookie } from "@/lib/view-client";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

type ShopOption = Pick<LocationWithBusiness, "id" | "name" | "business_name">;

/**
 * The owner's environment switcher — always visible under the header so it is
 * never a mystery which context the app is in. "All of Kibali" = dashboards
 * and business-wide screens; a shop = work that shop exactly like its manager.
 */
export function ViewSwitcher({
  locations,
  viewLocationId,
}: {
  locations: ShopOption[];
  viewLocationId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [choosing, setChoosing] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const current = viewLocationId ? locations.find((l) => l.id === viewLocationId) : null;

  function choose(value: string) {
    setChoosing(value);
    setViewCookie(value);
    startTransition(() => {
      router.push(value === "all" ? "/dashboard" : `/home?location=${value}`);
      router.refresh();
      setOpen(false);
      setChoosing(null);
    });
  }

  return (
    <>
      <div className="sticky top-14 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto w-full max-w-3xl px-3 py-1.5 sm:px-4">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex h-10 w-full items-center gap-2 rounded border border-border bg-muted/50 px-3 text-left active:scale-[0.99]"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
            ) : current ? (
              <Store className="h-4 w-4 shrink-0 text-primary" />
            ) : (
              <Globe className="h-4 w-4 shrink-0 text-primary" />
            )}
            <span className="min-w-0 flex-1 truncate text-sm">
              <span className="text-muted-foreground">Working in: </span>
              <span className="font-semibold">
                {current ? current.name : "All of Kibali"}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-0.5 text-xs font-semibold text-primary">
              Change <ChevronDown className="h-4 w-4" />
            </span>
          </button>
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Where do you want to work?">
        <div className="flex flex-col gap-2">
          <SwitchCard
            label="All of Kibali"
            sub="Dashboard, suppliers, investors — everything"
            icon={Globe}
            active={!current}
            busy={pending && choosing === "all"}
            onClick={() => choose("all")}
          />
          {locations.map((l) => (
            <SwitchCard
              key={l.id}
              label={l.name}
              sub={`Record sales, stock & spending at ${l.name}`}
              icon={Store}
              active={current?.id === l.id}
              busy={pending && choosing === l.id}
              onClick={() => choose(l.id)}
            />
          ))}
        </div>
      </Modal>
    </>
  );
}

function SwitchCard({
  label,
  sub,
  icon: Icon,
  active,
  busy,
  onClick,
}: {
  label: string;
  sub: string;
  icon: typeof Store;
  active: boolean;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-16 items-center gap-3 rounded border-2 p-3 text-left transition-colors active:scale-[0.99]",
        active ? "border-primary bg-primary/5" : "border-border bg-background"
      )}
    >
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
          active ? "bg-primary text-primary-foreground" : "bg-muted text-primary"
        )}
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{label}</span>
        <span className="block text-xs text-muted-foreground">{sub}</span>
      </span>
      {active && <Check className="h-5 w-5 shrink-0 text-primary" />}
    </button>
  );
}
