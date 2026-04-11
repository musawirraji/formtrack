import "server-only";

import { createServerSupabase } from "@/infrastructure/supabase/server";
import { createAdminSupabase } from "@/infrastructure/supabase/admin";
import { requireWorkspace } from "@/lib/auth/requireWorkspace";
import type { Json, Tables, TablesInsert } from "@/types/database";

/**
 * Audit log — a lightweight, append-only record of security-relevant
 * workspace events. Writes go through the admin client because some
 * callers (OAuth callbacks, webhook handlers) run outside of an
 * authenticated request context, but reads are RLS-scoped.
 *
 * Note the column naming: the migration uses `actor_user_id` /
 * `resource_type` / `resource_id`, so this service maps our nicer
 * userId / entityType / entityId names onto those.
 */

export interface AuditLogEntry {
  readonly id: number;
  readonly createdAt: string;
  readonly actorUserId: string | null;
  readonly action: string;
  readonly resourceType: string | null;
  readonly resourceId: string | null;
  readonly metadata: Record<string, unknown>;
}

export interface WriteAuditInput {
  readonly workspaceId: string;
  readonly userId: string | null;
  readonly action: string;
  readonly entityType?: string;
  readonly entityId?: string;
  readonly metadata?: Record<string, unknown>;
}

export async function writeAuditLog(input: WriteAuditInput): Promise<void> {
  const admin = createAdminSupabase();
  const payload: TablesInsert<"audit_log"> = {
    workspace_id: input.workspaceId,
    actor_user_id: input.userId,
    action: input.action,
    resource_type: input.entityType ?? null,
    resource_id: input.entityId ?? null,
    metadata: (input.metadata ?? {}) as unknown as Json,
  };
  const { error } = await admin.from("audit_log").insert(payload);
  if (error) {
    // Audit log failures are not fatal — we don't want a logging bug
    // to take down OAuth callbacks. Log and move on.
    console.error("writeAuditLog failed:", error.message);
  }
}

function toEntry(row: Tables<"audit_log">): AuditLogEntry {
  return {
    id: row.id,
    createdAt: row.created_at,
    actorUserId: row.actor_user_id,
    action: row.action,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
  };
}

export async function listAuditLog(
  options: { limit?: number } = {},
): Promise<AuditLogEntry[]> {
  const ctx = await requireWorkspace();
  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from("audit_log")
    .select("*")
    .eq("workspace_id", ctx.workspace.id)
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 100);

  if (error) throw new Error(`listAuditLog: ${error.message}`);
  return (data ?? []).map(toEntry);
}
