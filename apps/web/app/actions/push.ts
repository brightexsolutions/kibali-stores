"use server";

import type { ActionResult } from "@kibali/shared";
import { getSessionMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** Save this device's push subscription (owners/super admins only). */
export async function savePushSubscription(sub: PushSubscriptionInput): Promise<ActionResult> {
  const member = await getSessionMember();
  if (!member) return { ok: false, error: "Not signed in." };
  if (member.role === "manager") {
    return { ok: false, error: "Notifications are for owners and the super admin." };
  }
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return { ok: false, error: "That subscription looks incomplete." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: member.userId,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    },
    { onConflict: "endpoint" }
  );
  if (error) {
    console.error("[push.savePushSubscription]", error.message);
    return { ok: false, error: "Could not turn notifications on. Try again." };
  }
  return { ok: true };
}

export async function deletePushSubscription(endpoint: string): Promise<ActionResult> {
  const member = await getSessionMember();
  if (!member) return { ok: false, error: "Not signed in." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("user_id", member.userId);
  if (error) {
    console.error("[push.deletePushSubscription]", error.message);
    return { ok: false, error: "Could not turn notifications off. Try again." };
  }
  return { ok: true };
}
