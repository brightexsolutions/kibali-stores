"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  LayoutGrid,
  MoreHorizontal,
  Package,
  ShoppingCart,
  Truck,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MemberRole } from "@kibali/shared";

interface NavItem {
  href: string;
  label: string;
  icon: typeof ShoppingCart;
  match: (path: string) => boolean;
  raised?: boolean;
}

function shopItems(q: string): NavItem[] {
  return [
    { href: `/home${q}`, label: "Home", icon: LayoutGrid, match: (p) => p === "/home" },
    { href: `/stock${q}`, label: "Stock", icon: Package, match: (p) => p === "/stock" },
    { href: `/sale/new${q}`, label: "Record Sale", icon: ShoppingCart, match: (p) => p.startsWith("/sale"), raised: true },
    { href: `/today${q}`, label: "Today", icon: ClipboardList, match: (p) => p === "/today" },
    { href: "/more", label: "More", icon: MoreHorizontal, match: (p) => p === "/more" },
  ];
}

const GENERAL_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: LayoutGrid, match: (p) => p === "/dashboard" },
  { href: "/suppliers", label: "Suppliers", icon: Truck, match: (p) => p.startsWith("/suppliers") },
  { href: "/sale/new", label: "Record Sale", icon: ShoppingCart, match: (p) => p.startsWith("/sale"), raised: true },
  { href: "/investors", label: "Investors", icon: Users, match: (p) => p.startsWith("/investors") },
  { href: "/more", label: "More", icon: MoreHorizontal, match: (p) => p === "/more" },
];

/**
 * The nav follows the chosen working environment (the view switcher), never
 * the current route — so it doesn't reshuffle underneath the user mid-task.
 * Managers are always in their shop's environment; owners are in the shop
 * they picked, or the general "All of Kibali" environment.
 */
export function BottomNav({
  role,
  viewLocationId,
}: {
  role: MemberRole;
  viewLocationId: string | null;
}) {
  const pathname = usePathname();

  const items =
    role === "manager"
      ? shopItems("")
      : viewLocationId
        ? shopItems(`?location=${viewLocationId}`)
        : GENERAL_ITEMS;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex h-16 w-full max-w-3xl items-stretch justify-around">
        {items.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;

          if (item.raised) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative flex flex-1 flex-col items-center justify-end pb-1.5"
              >
                <span className="absolute -top-5 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-emerald-700 text-primary-foreground shadow-lg shadow-primary/30 ring-4 ring-background">
                  <Icon className="h-6 w-6" />
                </span>
                <span className="mt-8 whitespace-nowrap text-[11px] font-semibold text-primary">{item.label}</span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
