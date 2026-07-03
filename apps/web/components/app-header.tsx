import Link from "next/link";
import { CircleHelp } from "lucide-react";
import { SignOutButton } from "@/components/sign-out-button";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-bold text-primary">
          Kibali Stores
        </Link>
        <div className="flex items-center gap-1">
          <Link
            href="/help"
            aria-label="Help"
            className="flex h-11 w-11 items-center justify-center rounded hover:bg-muted"
          >
            <CircleHelp className="h-6 w-6 text-muted-foreground" />
          </Link>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
