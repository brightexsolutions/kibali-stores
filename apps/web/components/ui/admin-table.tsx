import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Brightex admin listing table: max-h-[440px] overflow-y-auto + sticky thead.
 * Hugs content when short, scrolls when tall.
 *
 * Pass `mobile` to swap the table for a card list below the `sm:` breakpoint —
 * phones never scroll a table sideways. Build the cards from MobileCard /
 * MobileField below so every listing looks the same.
 */
export function AdminTable({
  headers,
  children,
  mobile,
  className,
}: {
  headers: React.ReactNode[];
  children: React.ReactNode;
  /** Card list rendered instead of the table on phones. */
  mobile?: React.ReactNode;
  className?: string;
}) {
  return (
    <>
      {mobile && <div className="flex max-h-[560px] flex-col gap-2 overflow-y-auto sm:hidden">{mobile}</div>}
      <div className={cn("max-h-[440px] overflow-auto rounded border", mobile && "hidden sm:block", className)}>
        <table className="w-full min-w-max text-sm">
          <thead className="sticky top-0 z-10 bg-secondary text-left">
            <tr>
              {headers.map((h, i) => (
                <th key={i} className="whitespace-nowrap px-3 py-2 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">{children}</tbody>
        </table>
      </div>
    </>
  );
}

export function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-3 py-2 align-middle", className)} {...props} />;
}

/** One row-as-a-card on phones. */
export function MobileCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2 rounded border bg-background p-3 shadow-sm", className)}>
      {children}
    </div>
  );
}

/** Label/value line inside a MobileCard. */
export function MobileField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}
