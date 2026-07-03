import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionMember } from "@/lib/auth";
import { greeting } from "@/lib/utils";

/** Shown only to signed-in users who have no active membership yet. */
export default async function WelcomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const member = await getSessionMember();
  if (member) redirect("/");

  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-4 py-24 text-center">
      <h1 className="text-2xl font-bold">{greeting()} 👋</h1>
      <p className="text-muted-foreground">
        You are signed in as <strong>{user.email}</strong>, but this account
        has no role yet.
      </p>
      <p className="text-sm text-muted-foreground">
        Ask the super admin to set up your account, then sign in again.
      </p>
    </div>
  );
}
