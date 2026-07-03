import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Brightex admin listing table: max-h-[440px] overflow-y-auto + sticky thead.
 * Hugs content when short, scrolls when tall.
 */
export function AdminTable({
  headers,
  children,
  className,
}: {
  headers: React.ReactNode[];
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("max-h-[440px] overflow-y-auto rounded border", className)}>
      <table className="w-full text-sm">
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
  );
}

export function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-3 py-2 align-middle", className)} {...props} />;
}
