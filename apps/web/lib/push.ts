import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Server-side push sending. Everything here uses the admin client because
 * notifications fire from managers' actions too (a manager's sale can trigger
 * an owner's low-stock alert) and the receiving owner is not the actor.
 * If VAPID keys aren't configured, everything degrades to a silent no-op.
 */

function configured() {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:info.brightexsolutions@gmail.com",
    pub,
    priv
  );
  return true;
}

export interface PushMessage {
  title: string;
  body: string;
  /** Path opened when the notification is tapped, e.g. "/stock?location=all" */
  url?: string;
}

/** Send to every device of every active owner / super admin. */
export async function sendToOwners(message: PushMessage) {
  if (!configured()) return;
  const admin = createAdminClient();

  const { data: owners } = await admin
    .from("members")
    .select("user_id")
    .in("role", ["owner", "super_admin"])
    .eq("is_active", true);
  const userIds = (owners ?? []).map((o) => o.user_id);
  if (userIds.length === 0) return;

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", userIds);

  const payload = JSON.stringify(message);
  await Promise.all(
    (subs ?? []).map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        // 404/410 = the device unsubscribed or the browser expired it — prune.
        if (status === 404 || status === 410) {
          await admin.from("push_subscriptions").delete().eq("id", sub.id);
        } else {
          console.error("[push.sendToOwners]", status, sub.endpoint.slice(0, 60));
        }
      }
    })
  );
}

/**
 * Send at most once per (kind, entityKey) per day — e.g. one "low stock"
 * alert per product per shop per day, no matter how many sales trip it.
 */
export async function notifyOwnersOnce(kind: string, entityKey: string, message: PushMessage) {
  if (!configured()) return;
  const admin = createAdminClient();
  const { data: inserted } = await admin
    .from("notification_events")
    .upsert(
      { kind, entity_key: entityKey, sent_on: new Date().toISOString().slice(0, 10) },
      { onConflict: "kind,entity_key,sent_on", ignoreDuplicates: true }
    )
    .select("id");
  if (!inserted || inserted.length === 0) return; // already sent today
  await sendToOwners(message);
}
