import type { DailyLocationSummary } from "@kibali/shared";
import type { MonthlyPoint } from "@/components/charts/monthly-bars";

export interface PeriodTotals {
  sales: number;
  spent: number; // cash expenses + loss value
  profit: number;
}

const EMPTY: PeriodTotals = { sales: 0, spent: 0, profit: 0 };

export function totalsFor(
  rows: DailyLocationSummary[],
  filter?: (row: DailyLocationSummary) => boolean
): PeriodTotals {
  return rows.reduce((acc, row) => {
    if (filter && !filter(row)) return acc;
    return {
      sales: acc.sales + Number(row.sales_total),
      spent: acc.spent + Number(row.cash_expenses) + Number(row.loss_value),
      profit: acc.profit + Number(row.actual_profit),
    };
  }, EMPTY);
}

export function monthKey(day: string) {
  return day.slice(0, 7); // "2026-07"
}

export function currentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

/** Group daily rows into the last `count` months for the shared bar chart. */
export function toMonthlyPoints(rows: DailyLocationSummary[], count = 6): MonthlyPoint[] {
  const points: MonthlyPoint[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const totals = totalsFor(rows, (row) => monthKey(row.day) === key);
    points.push({
      month: d.toLocaleDateString("en-KE", { month: "short" }),
      sales: totals.sales,
      spent: totals.spent,
      profit: totals.profit,
    });
  }
  return points;
}

export function sixMonthsAgoISO() {
  const d = new Date();
  d.setMonth(d.getMonth() - 5);
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}
