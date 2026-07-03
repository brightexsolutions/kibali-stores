import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { resolveLocation } from "@/lib/location";
import { ExpenseForm } from "./expense-form";

export default async function NewExpensePage({
  searchParams,
}: {
  searchParams: Promise<{ location?: string }>;
}) {
  const member = await requireMember();
  const { location: locationParam } = await searchParams;
  const { location } = await resolveLocation(member, locationParam);
  if (!location) redirect("/home");

  return (
    <ExpenseForm
      locationId={location.id}
      locationName={location.name}
      monthlyRent={location.monthly_rent}
    />
  );
}
