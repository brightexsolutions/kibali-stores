import { createClient } from "@/lib/supabase/server";
import { greeting } from "@/lib/utils";
import { SignOutButton } from "./sign-out-button";

export default async function WelcomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-bold">
        {greeting()} 👋
      </h1>
      <p className="text-muted-foreground">
        You are signed in as <strong>{user?.email}</strong>.
      </p>
      <p className="text-sm text-muted-foreground">
        Kibali Stores is being set up. Your home screen arrives with the next
        milestone.
      </p>
      <SignOutButton />
    </main>
  );
}
