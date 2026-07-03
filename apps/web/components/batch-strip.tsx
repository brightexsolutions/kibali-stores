import type { DeliveryProgress } from "@kibali/shared";
import { formatKES } from "@kibali/shared";
import { Badge } from "@/components/ui/badge";

/** Shared "stock batches" strip — how each supply is selling and what it earned. */
export function BatchStrip({
  batches,
  supplierNames,
}: {
  batches: DeliveryProgress[];
  supplierNames: Map<string, string>;
}) {
  if (batches.length === 0) {
    return (
      <p className="rounded border bg-background p-4 text-sm text-muted-foreground">
        No supplies recorded yet — batch profits will appear here.
      </p>
    );
  }
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {batches.map((b) => {
        const pct =
          b.total_pieces > 0
            ? Math.round(((b.total_pieces - b.pieces_remaining) / b.total_pieces) * 100)
            : 0;
        return (
          <div key={b.delivery_id} className="w-52 shrink-0 rounded border bg-card p-3">
            <div className="flex items-center justify-between gap-1">
              <span className="truncate text-sm font-semibold">
                {supplierNames.get(b.supplier_id) ?? "Supplier"}
              </span>
              {b.status === "finished" ? (
                <Badge variant="good">Finished ✓</Badge>
              ) : (
                <Badge>{pct}% sold</Badge>
              )}
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded bg-muted">
              <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              {new Date(b.delivery_date).toLocaleDateString("en-KE", { day: "numeric", month: "short" })} ·{" "}
              {b.status === "finished" ? "profit made" : "profit so far"}
            </div>
            <div className={`text-sm font-bold ${b.status === "finished" ? "text-primary" : ""}`}>
              {formatKES(b.realized_profit)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
