/**
 * Offline outbox (client-only): sales/expenses/losses recorded with no
 * connection wait here (localStorage) until OutboxSync replays them. Every
 * payload carries a client_ref uuid, so a replay that already landed
 * server-side is recognized instead of duplicated.
 */

export type OutboxKind = "sale" | "expense" | "loss";

export interface OutboxItem {
  id: string;
  kind: OutboxKind;
  payload: Record<string, unknown>;
  queuedAt: string;
}

const KEY = "kibali-outbox";
export const OUTBOX_EVENT = "kibali-outbox-change";

function read(): OutboxItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as OutboxItem[];
  } catch {
    return [];
  }
}

function write(items: OutboxItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(OUTBOX_EVENT));
}

export function queueRecord(kind: OutboxKind, payload: Record<string, unknown>): void {
  const items = read();
  items.push({
    id: crypto.randomUUID(),
    kind,
    payload,
    queuedAt: new Date().toISOString(),
  });
  write(items);
}

export function listOutbox(): OutboxItem[] {
  return read();
}

export function removeFromOutbox(id: string): void {
  write(read().filter((i) => i.id !== id));
}

export function outboxCount(): number {
  return read().length;
}
