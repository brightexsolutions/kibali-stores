import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AdminTable, MobileCard, Td } from "@/components/ui/admin-table";

const ACTION_LABELS: Record<string, string> = {
  "sale.created": "recorded a sale",
  "sales.removed": "removed a sale",
  "expense.created": "recorded money spent",
  "expenses.removed": "removed an expense",
  "delivery.created": "recorded stock arrival",
  "deliveries.removed": "removed a delivery",
  "loss.created": "recorded spoiled/lost stock",
  "stock_losses.removed": "removed a loss record",
  "distribution.created": "sent stock to a shop",
  "supplier_payment.created": "paid a supplier",
  "product.created": "added a product",
  "product.updated": "changed a product",
  "product.retired": "retired a product",
  "product.activated": "re-activated a product",
  "business.created": "added a business",
  "business.updated": "changed a business",
  "location.created": "added a shop",
  "location.updated": "changed a shop",
  "supplier.created": "added a supplier",
  "supplier.updated": "changed a supplier",
  "account.created": "created an account",
  "account.deactivated": "deactivated an account",
  "account.activated": "re-activated an account",
  "account.password_reset": "reset a password",
  "account.password_changed": "changed their password",
  "investor.created": "added an investor",
  "investor.updated": "changed an investor",
  "investor.link_regenerated": "made a new investor link",
  "capital.invested": "recorded an investment",
  "distribution.confirmed": "confirmed a profit split",
  "allocation.disbursed": "disbursed a profit share",
  "allocation.returned_to_business": "returned a share to the business",
};

export default async function ActivityPage() {
  await requireOwner();
  const supabase = await createClient();

  const [{ data: logs }, { data: profiles }] = await Promise.all([
    supabase
      .from("audit_logs")
      .select("id, actor_id, action, entity, entity_id, details, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("profiles").select("id, full_name"),
  ]);

  const nameOf = (id: string) => (profiles ?? []).find((p) => p.id === id)?.full_name ?? "Someone";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Link href="/dashboard" aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Activity Log</h1>
          <p className="text-sm text-muted-foreground">
            Who did what, and when — nothing here can be edited or deleted.
          </p>
        </div>
      </div>

      {(logs ?? []).length === 0 ? (
        <p className="rounded border bg-background p-6 text-center text-muted-foreground">
          Nothing yet — actions will appear here as the team works.
        </p>
      ) : (
        <AdminTable
          headers={["When", "Who", "Did what"]}
          mobile={(logs ?? []).map((log) => (
            <MobileCard key={log.id} className="gap-0.5">
              <div className="text-sm">
                <span className="font-semibold">{nameOf(log.actor_id)}</span>{" "}
                {ACTION_LABELS[log.action] ?? log.action}
              </div>
              <div className="text-xs text-muted-foreground">
                {new Date(log.created_at).toLocaleString("en-KE", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </MobileCard>
          ))}
        >
          {(logs ?? []).map((log) => (
            <tr key={log.id}>
              <Td className="whitespace-nowrap text-xs text-muted-foreground">
                {new Date(log.created_at).toLocaleString("en-KE", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Td>
              <Td className="font-medium">{nameOf(log.actor_id)}</Td>
              <Td>{ACTION_LABELS[log.action] ?? log.action}</Td>
            </tr>
          ))}
        </AdminTable>
      )}
    </div>
  );
}
