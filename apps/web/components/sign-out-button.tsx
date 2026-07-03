"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={signOut}
      aria-label="Sign out"
      className="flex h-11 w-11 items-center justify-center rounded hover:bg-muted"
    >
      <LogOut className="h-5 w-5 text-muted-foreground" />
    </button>
  );
}
