import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LandingPage } from "@/components/landing-page";

export const metadata: Metadata = {
  title: "Kibali Enterprise — Simple business records for busy shops",
  description:
    "Sales, stock, supplier money and profit, all in one place, on your phone. No accounting jargon, no training needed.",
};

/**
 * Public marketing landing page for logged-out visitors.
 * Signed-in users are routed straight to their home screen (managers),
 * dashboard (owners/super admin), or /welcome if their account has no
 * membership yet — same as before.
 */
export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <LandingPage />;

  const member = await getSessionMember();
  if (!member) redirect("/welcome");
  if (member.mustChangePassword) redirect("/account/password");
  redirect(member.role === "manager" ? "/home" : "/dashboard");
}
