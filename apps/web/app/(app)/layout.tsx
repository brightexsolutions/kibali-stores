import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { AutoRefresh } from "@/components/auto-refresh";
import { BottomNav } from "@/components/bottom-nav";
import { getSessionMember } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const member = await getSessionMember();

  return (
    <div className="min-h-dvh bg-muted/30">
      <AutoRefresh />
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl p-4 pb-24">{children}</main>
      {member && !member.mustChangePassword && (
        <Suspense fallback={null}>
          <BottomNav role={member.role} />
        </Suspense>
      )}
    </div>
  );
}
