import "server-only";

import { createServerSupabase } from "@/infrastructure/supabase/server";
import { createAdminSupabase } from "@/infrastructure/supabase/admin";
import { requireWorkspace, type AuthenticatedContext } from "@/lib/auth/requireWorkspace";
import type {
  LeadSourceChannel,
  LeadSourceConfidence,
  Tables,
} from "@/types/database";

/** Pick the right client based on JWT freshness. */
async function getClient(ctx: AuthenticatedContext) {
  return ctx.jwtStale ? createAdminSupabase() : await createServerSupabase();
}

/**
 * Leads feature service. All reads go through the user-scoped
 * Supabase client so RLS enforces tenancy. The dashboard and
 * attribution reports both build on the same two primitives:
 *
 *   - `listLeads(filters)` — paginated + searchable table view
 *   - `getAttributionBreakdown(range)` — source-channel aggregates
 *
 * Writes are intentionally absent — lead inserts happen through the
 * admin-client submission API. The dashboard is read-only.
 */

export interface LeadSummary {
  readonly id: string;
  readonly formId: string;
  readonly email: string | null;
  readonly name: string | null;
  readonly phone: string | null;
  readonly sourceChannel: LeadSourceChannel;
  readonly sourceLabel: string;
  readonly sourceConfidence: LeadSourceConfidence;
  readonly sourceCampaign: string | null;
  readonly createdAt: string;
}

export interface LeadDetail extends LeadSummary {
  readonly values: Record<string, unknown>;
  readonly sourceExplanation: string;
  readonly sourceReferrerHost: string | null;
  readonly attributionRaw: Record<string, unknown>;
  readonly country: string | null;
  readonly userAgent: string | null;
}

export interface ListLeadsFilters {
  readonly search?: string;
  readonly formId?: string;
  readonly channel?: LeadSourceChannel;
  readonly limit?: number;
  readonly offset?: number;
}

export class LeadNotFoundError extends Error {
  constructor(id: string) {
    super(`Lead ${id} not found`);
    this.name = "LeadNotFoundError";
  }
}

// ─── List leads ────────────────────────────────────────
export async function listLeads(
  filters: ListLeadsFilters = {},
): Promise<{ leads: LeadSummary[]; total: number }> {
  const ctx = await requireWorkspace();
  const supabase = await getClient(ctx);

  const limit = Math.min(filters.limit ?? 50, 200);
  const offset = filters.offset ?? 0;

  let query = supabase
    .from("leads")
    .select(
      "id, form_id, email, name, phone, source_channel, source_label, source_confidence, source_campaign, created_at",
      { count: "exact" },
    )
    .eq("workspace_id", ctx.workspace.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (filters.formId) query = query.eq("form_id", filters.formId);
  if (filters.channel) query = query.eq("source_channel", filters.channel);
  if (filters.search) {
    const like = `%${filters.search.toLowerCase()}%`;
    query = query.or(`email.ilike.${like},name.ilike.${like}`);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(`listLeads: ${error.message}`);

  return {
    leads: (data ?? []).map(toLeadSummary),
    total: count ?? 0,
  };
}

// ─── Get lead detail ───────────────────────────────────
export async function getLead(id: string): Promise<LeadDetail> {
  const ctx = await requireWorkspace();
  const supabase = await getClient(ctx);

  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("workspace_id", ctx.workspace.id)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`getLead: ${error.message}`);
  if (!data) throw new LeadNotFoundError(id);

  return toLeadDetail(data);
}

// ─── Attribution breakdown ────────────────────────────
export interface AttributionBreakdownRow {
  readonly channel: LeadSourceChannel;
  readonly label: string;
  readonly count: number;
  readonly highConfidenceCount: number;
  readonly mediumConfidenceCount: number;
  readonly lowConfidenceCount: number;
}

export async function getAttributionBreakdown(params: {
  readonly sinceIso?: string;
  readonly formId?: string;
}): Promise<{
  rows: AttributionBreakdownRow[];
  total: number;
  confidenceTotals: Record<LeadSourceConfidence, number>;
}> {
  const ctx = await requireWorkspace();
  const supabase = await getClient(ctx);

  let query = supabase
    .from("leads")
    .select("source_channel, source_label, source_confidence")
    .eq("workspace_id", ctx.workspace.id);
  if (params.sinceIso) query = query.gte("created_at", params.sinceIso);
  if (params.formId) query = query.eq("form_id", params.formId);

  const { data, error } = await query;
  if (error) throw new Error(`getAttributionBreakdown: ${error.message}`);

  const map = new Map<LeadSourceChannel, AttributionBreakdownRow>();
  const confidenceTotals: Record<LeadSourceConfidence, number> = {
    high: 0,
    medium: 0,
    low: 0,
  };

  for (const row of data ?? []) {
    const key = row.source_channel;
    const existing =
      map.get(key) ??
      ({
        channel: key,
        label: row.source_label,
        count: 0,
        highConfidenceCount: 0,
        mediumConfidenceCount: 0,
        lowConfidenceCount: 0,
      } as AttributionBreakdownRow);

    const next = {
      ...existing,
      count: existing.count + 1,
      highConfidenceCount:
        existing.highConfidenceCount + (row.source_confidence === "high" ? 1 : 0),
      mediumConfidenceCount:
        existing.mediumConfidenceCount +
        (row.source_confidence === "medium" ? 1 : 0),
      lowConfidenceCount:
        existing.lowConfidenceCount + (row.source_confidence === "low" ? 1 : 0),
    };
    map.set(key, next);
    confidenceTotals[row.source_confidence] += 1;
  }

  const rows = Array.from(map.values()).sort((a, b) => b.count - a.count);
  return { rows, total: (data ?? []).length, confidenceTotals };
}

// ─── Mappers ───────────────────────────────────────────
function toLeadSummary(row: Partial<Tables<"leads">>): LeadSummary {
  return {
    id: row.id as string,
    formId: row.form_id as string,
    email: row.email ?? null,
    name: row.name ?? null,
    phone: row.phone ?? null,
    sourceChannel: row.source_channel as LeadSourceChannel,
    sourceLabel: row.source_label as string,
    sourceConfidence: row.source_confidence as LeadSourceConfidence,
    sourceCampaign: row.source_campaign ?? null,
    createdAt: row.created_at as string,
  };
}

function toLeadDetail(row: Tables<"leads">): LeadDetail {
  return {
    ...toLeadSummary(row),
    values: (row.values ?? {}) as Record<string, unknown>,
    sourceExplanation: row.source_explanation,
    sourceReferrerHost: row.source_referrer_host,
    attributionRaw: (row.attribution_raw ?? {}) as Record<string, unknown>,
    country: row.country,
    userAgent: row.user_agent,
  };
}
