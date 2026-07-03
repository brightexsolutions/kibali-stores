/**
 * KES money formatting shared by every Kibali Stores app.
 * Always plain and readable: "KSh 1,250" — no decimals unless they matter.
 */
export function formatKES(amount: number | string | null | undefined): string {
  const n = typeof amount === "string" ? Number(amount) : amount ?? 0;
  if (!Number.isFinite(n)) return "KSh 0";
  const hasCents = Math.round(n * 100) % 100 !== 0;
  return `KSh ${n.toLocaleString("en-KE", {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  })}`;
}

/** "KSh 4,500" -> short form for tight chart labels: "4.5k" */
export function formatKESCompact(amount: number | null | undefined): string {
  const n = amount ?? 0;
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${n}`;
}
