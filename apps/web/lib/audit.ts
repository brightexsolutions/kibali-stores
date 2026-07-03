import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Append an audit_logs entry after a successful mutation.
 * Never throws — an audit failure must not undo real work — but it is
 * loudly logged so it can't rot silently.
 */
export async function logAction(
  supabase: SupabaseClient,
  actorId: string,
  action: string,
  entity: string,
  entityId?: string | null,
  details?: Record<string, unknown>
) {
  const { error } = await supabase.from("audit_logs").insert({
    actor_id: actorId,
    action,
    entity,
    entity_id: entityId ?? null,
    details: details ?? {},
  });
  if (error) {
    console.error(`[audit] failed to log ${action}:`, error.message);
  }
}
