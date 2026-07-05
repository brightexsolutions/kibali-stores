"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, LayoutGrid, Loader2, Store, Warehouse } from "lucide-react";
import type { LocationWithBusiness } from "@/lib/location";
import { setViewCookie } from "@/lib/view-client";
import { cn } from "@/lib/utils";

const TONES = [
  "from-indigo-500 to-violet-600",
  "from-sky-500 to-blue-600",
  "from-emerald-500 to-teal-600",
  "from-amber-400 to-orange-500",
  "from-rose-500 to-pink-600",
];

/** Owners switch which shop a screen is about; managers never see this. */
export function LocationPicker({
  locations,
  selectedId,
  allowMainStore,
  allowAll,
}: {
  locations: Pick<LocationWithBusiness, "id" | "name" | "business_name">[];
  selectedId?: string;
  allowMainStore?: boolean;
  /** Adds an "All shops" card that sets ?location=all — combined view instead of one shop at a time. */
  allowAll?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [choosing, setChoosing] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function choose(value: string) {
    setChoosing(value);
    // Picking a real shop also moves the owner's working environment there,
    // so the nav and every next screen stay in step ("main"/"all" are just
    // views of stock, not environments).
    if (value !== "main" && value !== "all") setViewCookie(value);
    const params = new URLSearchParams(searchParams.toString());
    params.set("location", value);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
      router.refresh();
      setChoosing(null);
    });
  }

  const busy = (value: string) => pending && choosing === value;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-muted-foreground">Choose a shop</p>
      <div className="grid grid-cols-2 gap-2">
        {allowAll && (
          <ShopCard
            label="All shops"
            sub="Everything combined"
            icon={LayoutGrid}
            tone="from-violet-500 to-purple-600"
            active={selectedId === "all"}
            busy={busy("all")}
            onClick={() => choose("all")}
          />
        )}
        {allowMainStore && (
          <ShopCard
            label="Main store"
            sub="Undistributed stock"
            icon={Warehouse}
            tone="from-slate-500 to-slate-700"
            active={selectedId === "main"}
            busy={busy("main")}
            onClick={() => choose("main")}
          />
        )}
        {locations.map((l, i) => (
          <ShopCard
            key={l.id}
            label={l.name}
            sub={l.business_name}
            icon={Store}
            tone={TONES[i % TONES.length]}
            active={selectedId === l.id}
            busy={busy(l.id)}
            onClick={() => choose(l.id)}
          />
        ))}
      </div>
    </div>
  );
}

function ShopCard({
  label,
  sub,
  icon: Icon,
  tone,
  active,
  busy,
  onClick,
}: {
  label: string;
  sub: string;
  icon: typeof Store;
  tone: string;
  active: boolean;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex h-24 flex-col items-center justify-center gap-1 rounded p-2 text-center shadow-sm transition-transform active:scale-[0.98]",
        active
          ? `bg-gradient-to-br ${tone} text-white ring-2 ring-offset-2 ring-primary`
          : "border-2 border-border bg-background text-foreground",
        busy && "opacity-80"
      )}
    >
      {active && !busy && (
        <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white/25">
          <Check className="h-3.5 w-3.5" />
        </span>
      )}
      {busy ? (
        <Loader2 className={cn("h-6 w-6 animate-spin", active ? "text-white" : "text-primary")} />
      ) : (
        <Icon className={cn("h-6 w-6", active ? "text-white" : "text-primary")} />
      )}
      <span className="text-sm font-semibold leading-tight">{label}</span>
      <span className={cn("text-[11px] leading-tight", active ? "text-white/80" : "text-muted-foreground")}>
        {sub}
      </span>
    </button>
  );
}
