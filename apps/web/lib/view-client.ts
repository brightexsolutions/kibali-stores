/**
 * Client half of the owner "working environment" (see lib/view.ts for the
 * server reader). The cookie is not sensitive — it only remembers which
 * shop the owner is currently working in ("all" = all of Kibali).
 */
export const VIEW_COOKIE = "kibali-view";

export function setViewCookie(value: string) {
  document.cookie = `${VIEW_COOKIE}=${value}; path=/; max-age=31536000; SameSite=Lax`;
}
