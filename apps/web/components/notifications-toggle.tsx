"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, BellOff, BellRing, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { deletePushSubscription, savePushSubscription } from "@/app/actions/push";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

type State = "loading" | "unsupported" | "off" | "on" | "blocked";

/**
 * Owners/super admins turn key alerts on per device: low stock warnings and
 * the evening "did every shop record today?" check, delivered even when the
 * app is closed (requires the app to be installed on iPhone).
 */
export function NotificationsToggle() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setState("blocked");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  async function turnOn() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) {
        toast.error("Notifications are not configured on the server yet.");
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
      const json = sub.toJSON();
      const result = await savePushSubscription({
        endpoint: sub.endpoint,
        keys: { p256dh: json.keys!.p256dh, auth: json.keys!.auth },
      });
      if (!result.ok) {
        await sub.unsubscribe();
        toast.error(result.error);
        return;
      }
      setState("on");
      toast.success("Notifications are on for this phone.");
    } catch (err) {
      console.error("[notifications-toggle]", err);
      toast.error("Could not turn notifications on.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await deletePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
      toast.success("Notifications are off for this phone.");
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading" || state === "unsupported") return null;

  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          {state === "on" ? <BellRing className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold">Notifications</div>
          <p className="text-xs text-muted-foreground">
            {state === "on"
              ? "On for this phone — low stock alerts and the evening check."
              : state === "blocked"
                ? "Blocked in your browser settings — allow notifications for this site to use them."
                : "Get low stock alerts and an evening check that every shop recorded."}
          </p>
        </div>
        {state !== "blocked" && (
          <button
            onClick={state === "on" ? turnOff : turnOn}
            disabled={busy}
            className={`flex h-11 shrink-0 items-center gap-1.5 rounded px-3 text-sm font-semibold ${
              state === "on"
                ? "border text-muted-foreground hover:bg-muted"
                : "bg-primary text-primary-foreground"
            }`}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : state === "on" ? (
              <BellOff className="h-4 w-4" />
            ) : (
              <Bell className="h-4 w-4" />
            )}
            {state === "on" ? "Turn off" : "Turn on"}
          </button>
        )}
      </CardContent>
    </Card>
  );
}
