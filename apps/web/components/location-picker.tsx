"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { LocationWithBusiness } from "@/lib/location";
import { Select } from "@/components/ui/select";

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
    <Select
      aria-label="Choose a shop"
      value={selectedId ?? ""}
      onChange={(e) => choose(e.target.value)}
    >
      <option value="">{allowMainStore ? "Main store (undistributed)" : "Choose a shop…"}</option>
      {locations.map((l) => (
        <option key={l.id} value={l.id}>
          {l.name} — {l.business_name}
        </option>
      ))}
    </Select>
  );
}
