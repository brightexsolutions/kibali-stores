import "server-only";
import { cookies } from "next/headers";

/**
 * The owner's chosen working environment: "all" (all of Kibali — dashboard,
 * suppliers, investors) or one shop's id (work that shop like a manager).
 * Set client-side by the ViewSwitcher / shop cards; read server-side here.
 * Managers never use this — they are pinned to their shop by their account.
 */
export const VIEW_COOKIE = "kibali-view";

export async function getViewCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(VIEW_COOKIE)?.value ?? null;
}
