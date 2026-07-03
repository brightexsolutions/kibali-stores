import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const GRADIENTS = {
  default: "",
  primary: "bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-900/10",
  warn: "bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md shadow-amber-900/10",
  info: "bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-md shadow-blue-900/10",
  danger: "bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-md shadow-red-900/10",
} as const;

/** Shared dashboard stat card: plain title, big number, one-line meaning — colored gradient variants. */
export function StatCard({
  title,
  value,
  hint,
  tone = "default",
  icon: Icon,
}: {
  title: string;
  value: string;
  hint?: string;
  tone?: keyof typeof GRADIENTS;
  icon?: LucideIcon;
}) {
  const gradient = tone !== "default";
  return (
    <div
      className={cn(
        "rounded border p-3",
        gradient ? GRADIENTS[tone] : "bg-card"
      )}
    >
      <div className="flex items-center justify-between">
        <div className={cn("text-xs", gradient ? "text-white/80" : "text-muted-foreground")}>
          {title}
        </div>
        {Icon && <Icon className={cn("h-4 w-4", gradient ? "text-white/70" : "text-muted-foreground")} />}
      </div>
      <div className="text-xl font-bold">{value}</div>
      {hint && (
        <div className={cn("text-xs", gradient ? "text-white/80" : "text-muted-foreground")}>{hint}</div>
      )}
    </div>
  );
}
