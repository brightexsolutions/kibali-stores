import { cn } from "@/lib/utils";

/** Shared dashboard stat card: plain title, big number, one-line meaning. */
export function StatCard({
  title,
  value,
  hint,
  tone,
}: {
  title: string;
  value: string;
  hint?: string;
  tone?: "default" | "primary" | "warn";
}) {
  return (
    <div
      className={cn(
        "rounded border bg-card p-3",
        tone === "primary" && "border-primary/40 bg-accent",
        tone === "warn" && "border-amber-300 bg-amber-50"
      )}
    >
      <div className="text-xs text-muted-foreground">{title}</div>
      <div className="text-xl font-bold">{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
