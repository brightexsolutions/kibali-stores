import type { LocationWithBusiness } from "@/lib/location";
import { LocationPicker } from "@/components/location-picker";

/**
 * First step of any record flow when an owner is in the general environment:
 * choose the shop right here, then the same page re-renders with the form.
 * (Picking also moves their working environment to that shop.)
 */
export function PickShop({
  title,
  locations,
}: {
  title: string;
  locations: Pick<LocationWithBusiness, "id" | "name" | "business_name">[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="text-sm text-muted-foreground">First, choose which shop this is for.</p>
      </div>
      <LocationPicker locations={locations} />
    </div>
  );
}
