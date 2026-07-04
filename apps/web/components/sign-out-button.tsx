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
      aria-label="Log out"
      className="flex h-11 items-center gap-1 rounded px-1.5 text-sm font-medium text-muted-foreground hover:bg-muted sm:gap-1.5 sm:px-2"
    >
      <LogOut className="h-5 w-5" />
      <span>Log out</span>
    </button>
  );
}
