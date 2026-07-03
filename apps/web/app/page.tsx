import { redirect } from "next/navigation";
import { getSessionMember } from "@/lib/auth";

/** Role router: managers → /home, owners & super admin → /dashboard. */
export default async function RootPage() {
  const member = await getSessionMember();
  if (!member) redirect("/welcome"); // middleware already bounced signed-out users to /login
  if (member.mustChangePassword) redirect("/account/password");
  redirect(member.role === "manager" ? "/home" : "/dashboard");
}
