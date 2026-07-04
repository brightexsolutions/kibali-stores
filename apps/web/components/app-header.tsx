import Link from "next/link";
import { MessageCircleQuestion } from "lucide-react";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-3 sm:px-4">
        <Link href="/" className="shrink-0 text-lg font-bold text-primary">
          <span className="sm:hidden">Kibali</span>
          <span className="hidden sm:inline">Kibali Stores</span>
        </Link>
        <div className="flex items-center gap-0.5">
          <ThemeToggle />
          <Link
            href="/help"
            className="flex h-11 items-center gap-1 rounded px-1.5 text-sm font-medium text-muted-foreground hover:bg-muted sm:gap-1.5 sm:px-2"
          >
            <MessageCircleQuestion className="h-5 w-5" />
            <span>Help</span>
          </Link>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
