"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, Store, Warehouse } from "lucide-react";
import type { LocationWithBusiness } from "@/lib/location";
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
}: {
  locations: Pick<LocationWithBusiness, "id" | "name" | "business_name">[];
  selectedId?: string;
  allowMainStore?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function choose(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("location", value);
    else params.delete("location");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-muted-foreground">Choose a shop</p>
      <div className="grid grid-cols-2 gap-2">
        {allowMainStore && (
          <ShopCard
            label="Main store"
            sub="Undistributed stock"
            icon={Warehouse}
            tone="from-slate-500 to-slate-700"
            active={!selectedId}
            onClick={() => choose("")}
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
  onClick,
}: {
  label: string;
  sub: string;
  icon: typeof Store;
  tone: string;
  active: boolean;
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
          : "border-2 border-border bg-background text-foreground"
      )}
    >
      {active && (
        <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white/25">
          <Check className="h-3.5 w-3.5" />
        </span>
      )}
      <Icon className={cn("h-6 w-6", active ? "text-white" : "text-primary")} />
      <span className="text-sm font-semibold leading-tight">{label}</span>
      <span className={cn("text-[11px] leading-tight", active ? "text-white/80" : "text-muted-foreground")}>
        {sub}
      </span>
    </button>
  );
}
