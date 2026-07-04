import Link from "next/link";
import {
  Activity,
  Banknote,
  BarChart3,
  Building2,
  PackagePlus,
  Send,
  Settings,
  Snowflake,
  Users2,
} from "lucide-react";
import { requireMember } from "@/lib/auth";
import { greeting } from "@/lib/utils";

const MANAGER_LINKS = [
  { href: "/expense/new", label: "Money Spent", icon: Banknote, tone: "from-amber-500 to-orange-500" },
  { href: "/delivery/new", label: "Stock Arrived", icon: PackagePlus, tone: "from-sky-500 to-blue-600" },
  { href: "/loss/new", label: "Spoiled / Lost", icon: Snowflake, tone: "from-rose-500 to-red-600" },
];

const OWNER_LINKS = [
  { href: "/reports", label: "Business Statement", icon: BarChart3, tone: "from-teal-500 to-cyan-600" },
  { href: "/distribute", label: "Send Stock", icon: Send, tone: "from-sky-500 to-blue-600" },
  { href: "/products", label: "Products & Prices", icon: PackagePlus, tone: "from-emerald-500 to-teal-600" },
  { href: "/team", label: "Team Accounts", icon: Users2, tone: "from-violet-500 to-purple-600" },
  { href: "/activity", label: "Activity Log", icon: Activity, tone: "from-slate-500 to-slate-700" },
  { href: "/settings", label: "Businesses & Shops", icon: Building2, tone: "from-amber-500 to-orange-500" },
];

export default async function MorePage() {
  const member = await requireMember();
  const firstName = member.fullName.split(" ")[0] || member.fullName;
  // Owners record shop-level actions too, same as managers, plus their own management links.
  const shopLinks = MANAGER_LINKS;
  const managementLinks = member.role === "manager" ? [] : OWNER_LINKS;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">{greeting()}, {firstName}</h1>
        <p className="text-sm text-muted-foreground">Everything else, in one place.</p>
      </div>

      {managementLinks.length > 0 && (
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Record something
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        {shopLinks.map(({ href, label, icon: Icon, tone }) => (
          <Link
            key={href}
            href={href}
            className={`flex h-28 flex-col items-center justify-center gap-2 rounded bg-gradient-to-br ${tone} p-3 text-center text-sm font-semibold text-white shadow-sm active:scale-[0.98]`}
          >
            <Icon className="h-7 w-7" />
            {label}
          </Link>
        ))}
      </div>

      {managementLinks.length > 0 && (
        <>
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Manage the business
          </p>
          <div className="grid grid-cols-2 gap-3">
            {managementLinks.map(({ href, label, icon: Icon, tone }) => (
              <Link
                key={href}
                href={href}
                className={`flex h-28 flex-col items-center justify-center gap-2 rounded bg-gradient-to-br ${tone} p-3 text-center text-sm font-semibold text-white shadow-sm active:scale-[0.98]`}
              >
                <Icon className="h-7 w-7" />
                {label}
              </Link>
            ))}
          </div>
        </>
      )}

      {member.role === "super_admin" && (
        <Link
          href="/settings"
          className="flex items-center justify-center gap-2 rounded border bg-background p-3 text-sm font-medium hover:bg-muted"
        >
          <Settings className="h-4 w-4" /> Profile & account settings
        </Link>
      )}
    </div>
  );
}
