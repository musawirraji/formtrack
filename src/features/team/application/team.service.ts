import "server-only";

import { createServerSupabase } from "@/infrastructure/supabase/server";
import { createAdminSupabase } from "@/infrastructure/supabase/admin";
import { requireWorkspace } from "@/lib/auth/requireWorkspace";
import { assertCanInviteMember } from "@/features/billing/application/gates";
import { writeAuditLog } from "@/features/audit/application/audit.service";
import type { WorkspaceRole } from "@/types/database";

/**
 * Team / membership service. Invites create a Supabase auth user if
 * one doesn't already exist (via admin generateLink), then slot them
 * into workspace_members with the requested role. All mutations are
 * gated on `requireWorkspace()` + role check so regular members can't
 * invite or kick anyone.
 */

export interface Member {
  readonly userId: string;
  readonly email: string | null;
  readonly role: WorkspaceRole;
  readonly joinedAt: string;
}

export class InsufficientPermissionError extends Error {
  constructor() {
    super("Only owners and admins can manage team members.");
    this.name = "InsufficientPermissionError";
  }
}

function assertCanManage(role: WorkspaceRole): void {
  if (role !== "owner" && role !== "admin") {
    throw new InsufficientPermissionError();
  }
}

export async function listMembers(): Promise<Member[]> {
  const ctx = await requireWorkspace();
  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from("workspace_members")
    .select("user_id, role, joined_at")
    .eq("workspace_id", ctx.workspace.id)
    .order("joined_at", { ascending: true });

  if (error) throw new Error(`listMembers: ${error.message}`);

  // Look up emails via admin client — auth.users isn't exposed to RLS.
  const admin = createAdminSupabase();
  const members: Member[] = [];
  for (const row of data ?? []) {
    const { data: userRes } = await admin.auth.admin.getUserById(row.user_id);
    members.push({
      userId: row.user_id,
      email: userRes?.user?.email ?? null,
      role: row.role,
      joinedAt: row.joined_at,
    });
  }
  return members;
}

export interface InviteInput {
  readonly email: string;
  readonly role: Exclude<WorkspaceRole, "owner">;
}

export async function inviteMember(input: InviteInput): Promise<void> {
  const ctx = await requireWorkspace();
  assertCanManage(ctx.workspace.role);
  await assertCanInviteMember(ctx.workspace.id, ctx.workspace.plan);

  const admin = createAdminSupabase();

  // 1. Find or create the auth user by email.
  //    Supabase returns the existing user if already present.
  const { data: existing } = await admin.auth.admin.listUsers();
  const found = existing?.users?.find(
    (u) => u.email?.toLowerCase() === input.email.toLowerCase(),
  );

  let userId: string;
  if (found) {
    userId = found.id;
  } else {
    const { data: created, error: createErr } =
      await admin.auth.admin.inviteUserByEmail(input.email);
    if (createErr || !created?.user?.id) {
      throw new Error(
        `inviteMember: ${createErr?.message ?? "failed to create user"}`,
      );
    }
    userId = created.user.id;
  }

  // 2. Insert (or upsert) into workspace_members.
  const { error: memErr } = await admin.from("workspace_members").upsert(
    {
      workspace_id: ctx.workspace.id,
      user_id: userId,
      role: input.role,
    },
    { onConflict: "workspace_id,user_id" },
  );
  if (memErr) throw new Error(`inviteMember: ${memErr.message}`);

  await writeAuditLog({
    workspaceId: ctx.workspace.id,
    userId: ctx.userId,
    action: "team.member_invited",
    entityType: "workspace_member",
    entityId: userId,
    metadata: { email: input.email, role: input.role },
  });
}

export async function removeMember(userId: string): Promise<void> {
  const ctx = await requireWorkspace();
  assertCanManage(ctx.workspace.role);

  if (userId === ctx.userId) {
    throw new Error("You can't remove yourself. Transfer ownership first.");
  }

  const admin = createAdminSupabase();
  const { error } = await admin
    .from("workspace_members")
    .delete()
    .eq("workspace_id", ctx.workspace.id)
    .eq("user_id", userId);
  if (error) throw new Error(`removeMember: ${error.message}`);

  await writeAuditLog({
    workspaceId: ctx.workspace.id,
    userId: ctx.userId,
    action: "team.member_removed",
    entityType: "workspace_member",
    entityId: userId,
  });
}
