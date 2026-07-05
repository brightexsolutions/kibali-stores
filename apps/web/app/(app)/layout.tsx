import { AppHeader } from "@/components/app-header";
import { AutoRefresh } from "@/components/auto-refresh";
import { BottomNav } from "@/components/bottom-nav";
import { OutboxSync } from "@/components/outbox-sync";
import { SwRegister } from "@/components/sw-register";
import { ViewSwitcher } from "@/components/view-switcher";
import { getSessionMember } from "@/lib/auth";
import { listAccessibleLocations } from "@/lib/location";
import { getViewCookie } from "@/lib/view";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const member = await getSessionMember();
  const isOwner = !!member && member.role !== "manager" && !member.mustChangePassword;

  // Owners work in a chosen environment: all of Kibali, or one shop.
  let locations: Awaited<ReturnType<typeof listAccessibleLocations>> = [];
  let viewLocationId: string | null = null;
  if (isOwner && member) {
    const [locs, view] = await Promise.all([listAccessibleLocations(member), getViewCookie()]);
    locations = locs;
    // A stale cookie (deleted shop) falls back to the general environment.
    viewLocationId = view && view !== "all" && locs.some((l) => l.id === view) ? view : null;
  }

  return (
    <div className="min-h-dvh bg-muted/30">
      <AutoRefresh />
      <SwRegister />
      <OutboxSync />
      <AppHeader />
      {isOwner && locations.length > 0 && (
        <ViewSwitcher locations={locations} viewLocationId={viewLocationId} />
      )}
      <main className="mx-auto w-full max-w-3xl p-4 pb-24">{children}</main>
      {member && !member.mustChangePassword && (
        <BottomNav role={member.role} viewLocationId={viewLocationId} />
      )}
    </div>
  );
}
