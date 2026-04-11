import "server-only";

import { createAdminSupabase } from "@/infrastructure/supabase/admin";
import { getPlanLimits, type PlanId } from "./plans";

/**
 * Plan gates. Throw before doing the work so the caller can surface
 * a friendly upgrade prompt instead of hitting a database error or,
 * worse, letting the action succeed and overcounting.
 */

export class PlanLimitError extends Error {
  readonly limit: string;
  readonly plan: PlanId;
  constructor(limit: string, plan: PlanId, message: string) {
    super(message);
    this.name = "PlanLimitError";
    this.limit = limit;
    this.plan = plan;
  }
}

export async function assertCanCreateForm(
  workspaceId: string,
  plan: PlanId,
): Promise<void> {
  const limits = getPlanLimits(plan);
  const admin = createAdminSupabase();
  const { count, error } = await admin
    .from("forms")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);
  if (error) throw new Error(`assertCanCreateForm: ${error.message}`);

  if ((count ?? 0) >= limits.maxForms) {
    throw new PlanLimitError(
      "maxForms",
      plan,
      `Your ${plan} plan allows ${limits.maxForms} form${
        limits.maxForms === 1 ? "" : "s"
      }. Upgrade to add more.`,
    );
  }
}

export async function assertCanConnectInbox(
  workspaceId: string,
  plan: PlanId,
): Promise<void> {
  const limits = getPlanLimits(plan);
  if (limits.maxInboxes === 0) {
    throw new PlanLimitError(
      "maxInboxes",
      plan,
      `The ${plan} plan does not include email auto-replies. Upgrade to connect an inbox.`,
    );
  }
  const admin = createAdminSupabase();
  const { count, error } = await admin
    .from("integrations")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("status", "active")
    .in("provider", ["google", "microsoft"]);
  if (error) throw new Error(`assertCanConnectInbox: ${error.message}`);

  if ((count ?? 0) >= limits.maxInboxes) {
    throw new PlanLimitError(
      "maxInboxes",
      plan,
      `Your ${plan} plan allows ${limits.maxInboxes} connected inbox${
        limits.maxInboxes === 1 ? "" : "es"
      }.`,
    );
  }
}

export async function assertCanInviteMember(
  workspaceId: string,
  plan: PlanId,
): Promise<void> {
  const limits = getPlanLimits(plan);
  const admin = createAdminSupabase();
  const { count, error } = await admin
    .from("workspace_members")
    .select("user_id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);
  if (error) throw new Error(`assertCanInviteMember: ${error.message}`);

  if ((count ?? 0) >= limits.maxTeamMembers) {
    throw new PlanLimitError(
      "maxTeamMembers",
      plan,
      `Your ${plan} plan allows ${limits.maxTeamMembers} team member${
        limits.maxTeamMembers === 1 ? "" : "s"
      }.`,
    );
  }
}
