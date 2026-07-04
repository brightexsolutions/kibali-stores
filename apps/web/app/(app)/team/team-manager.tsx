"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Plus } from "lucide-react";
import type { Location, MemberRole } from "@kibali/shared";
import { ROLE_LABELS } from "@kibali/shared";
import { AdminTable, Td } from "@/components/ui/admin-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { createAccount, resetPassword, setMemberActive } from "@/app/actions/team";

export interface TeamRow {
  memberId: string;
  userId: string;
  role: MemberRole;
  locationId: string | null;
  isActive: boolean;
  fullName: string;
  email: string;
  phone: string | null;
}

export function TeamManager({ rows, locations }: { rows: TeamRow[]; locations: Location[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [role, setRole] = useState<MemberRole>("manager");
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const locationName = (id: string | null) =>
    id ? locations.find((l) => l.id === id)?.name ?? "—" : "All shops";

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "");
    startTransition(async () => {
      const result = await createAccount(form);
      if (!result.ok) return void toast.error(result.error);
      setCreating(false);
      setCredentials({ email, password: result.data!.tempPassword });
      router.refresh();
    });
  }

  function toggleActive(row: TeamRow) {
    startTransition(async () => {
      const result = await setMemberActive(row.memberId, !row.isActive);
      if (!result.ok) return void toast.error(result.error);
      toast.success(row.isActive ? "Account deactivated." : "Account active again.");
      router.refresh();
    });
  }

  function reset(row: TeamRow) {
    startTransition(async () => {
      const result = await resetPassword(row.userId);
      if (!result.ok) return void toast.error(result.error);
      setCredentials({ email: row.email, password: result.data!.tempPassword });
    });
  }

  async function copyCredentials() {
    if (!credentials) return;
    await navigator.clipboard.writeText(
      `Kibali Stores login\nEmail: ${credentials.email}\nTemporary password: ${credentials.password}`
    );
    toast.success("Copied — share it with the person.");
  }

  return (
    <>
      <Button size="lg" onClick={() => setCreating(true)}>
        <Plus className="h-5 w-5" /> Create an account
      </Button>

      <AdminTable headers={["Person", "Role", "Shop", "Status", ""]}>
        {rows.map((row) => (
          <tr key={row.memberId} className={row.isActive ? "" : "opacity-50"}>
            <Td>
              <div className="font-medium">{row.fullName}</div>
              <div className="text-xs text-muted-foreground">{row.email}</div>
            </Td>
            <Td>{ROLE_LABELS[row.role]}</Td>
            <Td>{locationName(row.locationId)}</Td>
            <Td>
              <Badge variant={row.isActive ? "good" : "muted"}>
                {row.isActive ? "Active" : "Off"}
              </Badge>
            </Td>
            <Td className="whitespace-nowrap">
              {row.role !== "super_admin" && (
                <>
                  <Button variant="ghost" size="sm" disabled={pending} loading={pending} onClick={() => reset(row)}>
                    Reset password
                  </Button>
                  <Button variant="ghost" size="sm" disabled={pending} loading={pending} onClick={() => toggleActive(row)}>
                    {row.isActive ? "Deactivate" : "Activate"}
                  </Button>
                </>
              )}
            </Td>
          </tr>
        ))}
      </AdminTable>

      <Modal open={creating} onClose={() => setCreating(false)} title="Create an account">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="t-name">Full name</Label>
            <Input id="t-name" name="full_name" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="t-email">Email</Label>
            <Input id="t-email" name="email" type="email" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="t-phone">Phone (optional)</Label>
            <Input id="t-phone" name="phone" inputMode="tel" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="t-role">Role</Label>
            <Select
              id="t-role"
              name="role"
              value={role}
              onChange={(e) => setRole(e.target.value as MemberRole)}
            >
              <option value="manager">Shop Manager — one shop only</option>
              <option value="owner">Owner — sees everything</option>
              <option value="super_admin">Super Admin — full system control</option>
            </Select>
          </div>
          {role === "manager" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="t-loc">Which shop?</Label>
              <Select id="t-loc" name="location_id" required>
                <option value="">Choose a shop…</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <Button type="submit" size="lg" disabled={pending} loading={pending}>
            {pending ? "Creating…" : "Create account"}
          </Button>
        </form>
      </Modal>

      <Modal
        open={credentials !== null}
        onClose={() => setCredentials(null)}
        title="Share this login"
      >
        {credentials && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              This temporary password is shown <strong>only once</strong>. The person
              will be asked to choose their own password when they first sign in.
            </p>
            <div className="rounded border bg-muted p-4 font-mono text-sm">
              <div>Email: {credentials.email}</div>
              <div>Password: {credentials.password}</div>
            </div>
            <Button size="lg" onClick={copyCredentials}>
              <Copy className="h-4 w-4" /> Copy login details
            </Button>
          </div>
        )}
      </Modal>
    </>
  );
}
