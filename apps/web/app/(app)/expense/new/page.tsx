import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { resolveLocation } from "@/lib/location";
import { PickShop } from "@/components/pick-shop";
import { ExpenseForm } from "./expense-form";

export default async function NewExpensePage({
  searchParams,
}: {
  searchParams: Promise<{ location?: string }>;
}) {
  const member = await requireMember();
  const { location: locationParam } = await searchParams;
  const { location, all } = await resolveLocation(member, locationParam);
  if (!location) {
    if (member.role === "manager") redirect("/home");
    return <PickShop title="Money Spent" locations={all} />;
  }

  return (
    <ExpenseForm
      locationId={location.id}
      locationName={location.name}
      monthlyRent={location.monthly_rent}
      allowBackdate={member.role !== "manager"}
    />
  );
}
