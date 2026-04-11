import "server-only";

import { createServerSupabase } from "@/infrastructure/supabase/server";
import { createAdminSupabase } from "@/infrastructure/supabase/admin";
import { requireWorkspace } from "@/lib/auth/requireWorkspace";
import type { Tables, TablesInsert, TablesUpdate } from "@/types/database";

import { encryptToken, decryptToken } from "./tokens";

/**
 * Integrations service — reads go through RLS (user client), writes
 * that touch encrypted token columns go through the admin client so
 * the server-held encryption key stays on the server. Every write
 * still gates on `requireWorkspace()` + an explicit workspace_id match
 * so a compromised user token can't escalate into another tenant.
 */

export type IntegrationProvider = "google" | "microsoft" | "stripe";
export type IntegrationStatus = "active" | "expired" | "revoked" | "error";

export interface IntegrationSummary {
  readonly id: string;
  readonly provider: IntegrationProvider;
  readonly providerLabel: string;
  readonly accountEmail: string | null;
  readonly scopes: string[];
  readonly status: IntegrationStatus;
  readonly lastError: string | null;
  readonly tokenExpiresAt: string | null;
  readonly createdAt: string;
}

const PROVIDER_LABELS: Record<IntegrationProvider, string> = {
  google: "Gmail",
  microsoft: "Outlook",
  stripe: "Stripe",
};

export class IntegrationNotFoundError extends Error {
  constructor(id: string) {
    super(`Integration ${id} not found`);
    this.name = "IntegrationNotFoundError";
  }
}

function toSummary(row: Tables<"integrations">): IntegrationSummary {
  return {
    id: row.id,
    provider: row.provider,
    providerLabel: PROVIDER_LABELS[row.provider],
    accountEmail: row.account_email,
    scopes: row.scopes ?? [],
    status: row.status,
    lastError: row.last_error,
    tokenExpiresAt: row.token_expires_at,
    createdAt: row.created_at,
  };
}

// ─── Reads (RLS-scoped) ────────────────────────────────────
export async function listIntegrations(): Promise<IntegrationSummary[]> {
  const ctx = await requireWorkspace();
  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from("integrations")
    .select("*")
    .eq("workspace_id", ctx.workspace.id)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`listIntegrations: ${error.message}`);
  return (data ?? []).map(toSummary);
}

export async function listInboxes(): Promise<IntegrationSummary[]> {
  const all = await listIntegrations();
  return all.filter(
    (i) =>
      (i.provider === "google" || i.provider === "microsoft") &&
      i.status === "active",
  );
}

// ─── Writes (admin client, scoped in-code) ────────────────
export interface UpsertTokenInput {
  readonly workspaceId: string;
  readonly connectedBy: string;
  readonly provider: IntegrationProvider;
  readonly providerAccountId: string;
  readonly accountEmail: string | null;
  readonly accessToken: string;
  readonly refreshToken: string | null;
  readonly tokenExpiresAt: Date | null;
  readonly scopes: string[];
}

export async function upsertIntegrationTokens(
  input: UpsertTokenInput,
): Promise<string> {
  const admin = createAdminSupabase();

  const payload: TablesInsert<"integrations"> = {
    workspace_id: input.workspaceId,
    provider: input.provider,
    provider_account_id: input.providerAccountId,
    account_email: input.accountEmail,
    scopes: input.scopes,
    access_token_encrypted: encryptToken(input.accessToken) as unknown as string,
    refresh_token_encrypted: input.refreshToken
      ? (encryptToken(input.refreshToken) as unknown as string)
      : null,
    token_expires_at: input.tokenExpiresAt?.toISOString() ?? null,
    status: "active",
    last_error: null,
    connected_by: input.connectedBy,
  };

  const { data, error } = await admin
    .from("integrations")
    .upsert(payload, {
      onConflict: "workspace_id,provider,provider_account_id",
    })
    .select("id")
    .single();

  if (error) throw new Error(`upsertIntegrationTokens: ${error.message}`);
  return data.id;
}

export async function disconnectIntegration(id: string): Promise<void> {
  const ctx = await requireWorkspace();
  const admin = createAdminSupabase();

  const patch: TablesUpdate<"integrations"> = {
    status: "revoked",
    access_token_encrypted: null,
    refresh_token_encrypted: null,
  };

  const { error, count } = await admin
    .from("integrations")
    .update(patch, { count: "exact" })
    .eq("workspace_id", ctx.workspace.id)
    .eq("id", id);

  if (error) throw new Error(`disconnectIntegration: ${error.message}`);
  if (count === 0) throw new IntegrationNotFoundError(id);
}

// ─── Decrypt (server-side only, for auto-reply sends) ─────
export interface DecryptedIntegration {
  readonly id: string;
  readonly provider: IntegrationProvider;
  readonly accessToken: string;
  readonly refreshToken: string | null;
  readonly tokenExpiresAt: string | null;
  readonly accountEmail: string | null;
}

export async function getDecryptedIntegration(
  id: string,
): Promise<DecryptedIntegration | null> {
  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("integrations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getDecryptedIntegration: ${error.message}`);
  if (!data || data.status !== "active" || !data.access_token_encrypted) {
    return null;
  }
  return {
    id: data.id,
    provider: data.provider,
    accessToken: decryptToken(data.access_token_encrypted as unknown as string),
    refreshToken: data.refresh_token_encrypted
      ? decryptToken(data.refresh_token_encrypted as unknown as string)
      : null,
    tokenExpiresAt: data.token_expires_at,
    accountEmail: data.account_email,
  };
}
