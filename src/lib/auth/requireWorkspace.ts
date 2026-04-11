/**
 * Server-side helper: returns the authenticated user AND the workspace
 * they're currently acting inside. Intended for Server Components,
 * Server Actions, and Route Handlers.
 *
 * Defense in depth: RLS already blocks cross-tenant reads at the
 * database layer. This helper adds an app-layer guard so feature code
 * can trust that `workspace.id` is real and that the user is a member,
 * WITHOUT every feature re-implementing the same checks.
 *
 * Throws (not returns null) on failure so the caller can't accidentally
 * forget to handle the unauthenticated case. Catch in a layout or
 * route handler and redirect to /login.
 */

import { redirect } from "next/navigation";

import { createServerSupabase } from "@/infrastructure/supabase/server";
import type { WorkspaceRole } from "@/types/database";

export class NotAuthenticatedError extends Error {
  constructor() {
    super("Not authenticated");
    this.name = "NotAuthenticatedError";
  }
}

export class NoWorkspaceError extends Error {
  constructor() {
    super("User has no active workspace");
    this.name = "NoWorkspaceError";
  }
}

export class InsufficientRoleError extends Error {
  constructor(required: WorkspaceRole, actual: WorkspaceRole) {
    super(`Requires role ${required}, got ${actual}`);
    this.name = "InsufficientRoleError";
  }
}

export interface AuthenticatedContext {
  readonly userId: string;
  readonly email: string | null;
  readonly workspace: {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
    readonly plan: "free" | "starter" | "growth" | "business";
    readonly role: WorkspaceRole;
  };
}

/** Role hierarchy: owner > admin > member. */
const ROLE_RANK: Record<WorkspaceRole, number> = {
  owner: 3,
  admin: 2,
  member: 1,
};

function hasRole(actual: WorkspaceRole, required: WorkspaceRole): boolean {
  return ROLE_RANK[actual] >= ROLE_RANK[required];
}

/**
 * Resolve the current user + their active workspace. Throws if either
 * is missing — callers in page components should catch and `redirect`.
 *
 * @example
 *   const ctx = await requireWorkspace();
 *   // ctx.workspace.id is safe to use in queries; RLS + this guard
 *   // ensure it's a workspace the user is actually a member of.
 */
export async function requireWorkspace(options?: {
  readonly minRole?: WorkspaceRole;
}): Promise<AuthenticatedContext> {
  const supabase = await createServerSupabase();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new NotAuthenticatedError();
  }

  // The access token hook (migration 0007) writes the active workspace_id
  // into app_metadata. Read it back from the session so we don't need an
  // extra round-trip. Fall back to a direct lookup if the claim is
  // missing (e.g. a user who just signed up and hasn't refreshed yet).
  const metadataWorkspaceId =
    (user.app_metadata as { workspace_id?: string } | undefined)
      ?.workspace_id ?? null;

  let workspaceId = metadataWorkspaceId;

  if (!workspaceId) {
    const { data: fallback } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    workspaceId = fallback?.workspace_id ?? null;
  }

  if (!workspaceId) {
    throw new NoWorkspaceError();
  }

  // Load workspace + membership row in parallel. Both go through RLS,
  // so the response will be empty if the user isn't actually a member
  // — that's the point.
  const [workspaceRes, membershipRes] = await Promise.all([
    supabase
      .from("workspaces")
      .select("id, name, slug, plan")
      .eq("id", workspaceId)
      .maybeSingle(),
    supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (!workspaceRes.data || !membershipRes.data) {
    throw new NoWorkspaceError();
  }

  const role = membershipRes.data.role as WorkspaceRole;

  if (options?.minRole && !hasRole(role, options.minRole)) {
    throw new InsufficientRoleError(options.minRole, role);
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    workspace: {
      id: workspaceRes.data.id,
      name: workspaceRes.data.name,
      slug: workspaceRes.data.slug,
      plan: workspaceRes.data.plan,
      role,
    },
  };
}

/**
 * Variant that redirects to /login on failure instead of throwing.
 * Use in page.tsx files where Next.js expects you to handle auth by
 * redirecting.
 */
export async function requireWorkspaceOrRedirect(options?: {
  readonly minRole?: WorkspaceRole;
  readonly loginPath?: string;
}): Promise<AuthenticatedContext> {
  try {
    return await requireWorkspace({ minRole: options?.minRole });
  } catch (err) {
    if (err instanceof NotAuthenticatedError) {
      redirect(options?.loginPath ?? "/login");
    }
    if (err instanceof NoWorkspaceError) {
      redirect("/onboarding/workspace");
    }
    throw err;
  }
}
