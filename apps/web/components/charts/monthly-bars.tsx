"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatKES, formatKESCompact } from "@kibali/shared";

export interface MonthlyPoint {
  month: string; // "Feb", "Mar"…
  sales: number;
  spent: number;
  profit: number;
}

/**
 * Shared monthly bar chart — plainly labeled (Money in / Money spent / Profit),
 * sized for phone screens. Reused on every dashboard level.
 */
export function MonthlyBars({ data }: { data: MonthlyPoint[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis tickFormatter={(v) => formatKESCompact(v)} tickLine={false} axisLine={false} fontSize={12} />
          <Tooltip formatter={(value) => formatKES(Number(value))} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="sales" name="Money in" fill="#0d9464" radius={[2, 2, 0, 0]} />
          <Bar dataKey="spent" name="Money spent" fill="#f59e0b" radius={[2, 2, 0, 0]} />
          <Bar dataKey="profit" name="Profit" fill="#1d4ed8" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
