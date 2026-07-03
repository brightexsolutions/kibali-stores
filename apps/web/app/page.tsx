import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Role router: managers → /home, owners & super admin → /dashboard.
 * Until the members table lands (M1), any signed-in user sees the welcome stub.
 */
export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // M1 will read the member role here and redirect to /home or /dashboard.
  redirect("/welcome");
}
