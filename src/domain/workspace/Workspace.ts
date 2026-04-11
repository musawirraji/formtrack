/**
 * Workspace — the tenant boundary in FormTrack.
 *
 * Every piece of tenant-owned data (forms, leads, submissions, integrations)
 * is scoped to a workspace. RLS policies on every table match
 * `workspace_id = (auth.jwt() ->> 'workspace_id')::uuid`.
 */

export type WorkspaceId = string & { readonly __brand: "WorkspaceId" };
export type UserId = string & { readonly __brand: "UserId" };

export type WorkspacePlan = "free" | "starter" | "growth" | "business";
export type WorkspaceRole = "owner" | "admin" | "member";

export interface Workspace {
  id: WorkspaceId;
  name: string;
  slug: string;
  plan: WorkspacePlan;
  stripeCustomerId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMember {
  workspaceId: WorkspaceId;
  userId: UserId;
  role: WorkspaceRole;
  joinedAt: string;
}

export const WORKSPACE_PLAN_LIMITS: Record<
  WorkspacePlan,
  { submissionsPerMonth: number; forms: number; teamMembers: number }
> = {
  free:     { submissionsPerMonth: 100,    forms: 1,        teamMembers: 1 },
  starter:  { submissionsPerMonth: 1_000,  forms: 10,       teamMembers: 3 },
  growth:   { submissionsPerMonth: 5_000,  forms: 50,       teamMembers: 10 },
  business: { submissionsPerMonth: 25_000, forms: Infinity, teamMembers: Infinity },
};

/** Type-safe constructor for branded WorkspaceId. */
export const toWorkspaceId = (s: string): WorkspaceId => s as WorkspaceId;
export const toUserId = (s: string): UserId => s as UserId;
