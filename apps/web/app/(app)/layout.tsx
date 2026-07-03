import { AppHeader } from "@/components/app-header";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-muted/30">
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl p-4 pb-16">{children}</main>
    </div>
  );
}
