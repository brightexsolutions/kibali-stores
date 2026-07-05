"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CloudOff, Loader2, WifiOff } from "lucide-react";
import { OUTBOX_EVENT, listOutbox, outboxCount, removeFromOutbox } from "@/lib/outbox";
import { createExpense, createLoss, createSale } from "@/app/actions/records";

function toFormData(payload: Record<string, unknown>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(payload)) {
    if (value !== undefined && value !== null) form.append(key, String(value));
  }
  return form;
}

/**
 * Replays offline-recorded sales/expenses/losses whenever we're online,
 * and shows a "waiting to send" banner while anything is queued.
 */
export function OutboxSync() {
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [sending, setSending] = useState(false);
  const [offline, setOffline] = useState(false);
  const syncing = useRef(false);

  const sync = useCallback(async () => {
    if (syncing.current || !navigator.onLine) return;
    const items = listOutbox();
    if (items.length === 0) return;
    syncing.current = true;
    setSending(true);
    let sent = 0;

    try {
      for (const item of items) {
        let result;
        try {
          result =
            item.kind === "sale"
              ? await createSale(item.payload)
              : item.kind === "expense"
                ? await createExpense(toFormData(item.payload))
                : await createLoss(toFormData(item.payload));
        } catch {
          break; // still unreachable — keep the rest queued, retry later
        }
        removeFromOutbox(item.id);
        if (result.ok) {
          sent++;
        } else {
          // the server rejected it (validation/permissions) — dropping and
          // surfacing beats replaying a doomed record forever
          toast.error(`A saved ${item.kind} could not be sent: ${result.error}`);
        }
      }
    } finally {
      syncing.current = false;
      setSending(false);
      setCount(outboxCount());
    }

    if (sent > 0) {
      toast.success(`Sent ${sent} saved record${sent === 1 ? "" : "s"}.`);
      router.refresh();
    }
  }, [router]);

  useEffect(() => {
    setCount(outboxCount());
    setOffline(!navigator.onLine);
    const update = () => setCount(outboxCount());
    const onOnline = () => {
      setOffline(false);
      toast.success("Back online.");
      void sync();
    };
    const onOffline = () => {
      setOffline(true);
      toast.warning(
        "No connection — offline mode is on. You can still record sales, money spent and spoiled stock; they'll send automatically when you're back.",
        { duration: 8000 }
      );
    };
    window.addEventListener(OUTBOX_EVENT, update);
    window.addEventListener("storage", update);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const timer = setInterval(() => void sync(), 30_000);
    void sync(); // catch anything left from a previous session
    return () => {
      window.removeEventListener(OUTBOX_EVENT, update);
      window.removeEventListener("storage", update);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      clearInterval(timer);
    };
  }, [sync]);

  if (!offline && count === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center px-4">
      <div className="flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 shadow-lg dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
        {sending ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
        ) : offline ? (
          <WifiOff className="h-4 w-4 shrink-0" />
        ) : (
          <CloudOff className="h-4 w-4 shrink-0" />
        )}
        <span>
          {sending
            ? "Sending saved records…"
            : offline
              ? `Offline mode — recording still works${count > 0 ? ` (${count} waiting to send)` : ""}`
              : `${count} record${count === 1 ? "" : "s"} saved on this phone — will send when online`}
        </span>
      </div>
    </div>
  );
}
