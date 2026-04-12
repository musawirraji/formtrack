import "server-only";

import { createAdminSupabase } from "@/infrastructure/supabase/admin";
import { createServerSupabase } from "@/infrastructure/supabase/server";
import { DEFAULT_THEME, parseTheme } from "@/domain/form/theme";
import {
  formCreateSchema,
  formUpdateSchema,
  titleToSlug,
  type FormCreateInput,
  type FormUpdateInput,
} from "@/domain/form/validation";
import {
  NoWorkspaceError,
  requireWorkspace,
} from "@/lib/auth/requireWorkspace";
import { assertCanCreateForm } from "@/features/billing/application/gates";
import type { Json, Tables, TablesInsert } from "@/types/database";

/**
 * Forms feature service. Every function here:
 *
 *   1. Resolves the current workspace via `requireWorkspace()` so RLS
 *      and the app-layer guard both apply — no feature code ever
 *      passes a raw workspace_id in from outside.
 *   2. Goes through the user-scoped Supabase client so RLS enforces
 *      tenant boundaries at the database.
 *   3. Maps the DB row (`Tables<"forms">`) into a friendlier shape
 *      for the UI in one place so the rest of the app doesn't leak
 *      Postgres column names.
 *
 * Exception: when `requireWorkspace` reports a stale JWT (e.g. right
 * after signup before the token refreshes), write operations fall back
 * to the admin client scoped to the verified workspace_id. This is
 * safe because workspace membership was already confirmed.
 */

export interface FormSummary {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly status: "draft" | "published" | "archived";
  readonly fieldCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly publishedAt: string | null;
}

export interface FormDetail extends FormSummary {
  readonly theme: ReturnType<typeof parseTheme>;
  readonly submitButtonLabel: string;
  readonly successMessage: string;
  readonly autoReplyEnabled: boolean;
  readonly autoReplyTemplate: string | null;
  readonly connectedInboxId: string | null;
}

export class FormNotFoundError extends Error {
  constructor(id: string) {
    super(`Form ${id} not found`);
    this.name = "FormNotFoundError";
  }
}

export class SlugConflictError extends Error {
  constructor(slug: string) {
    super(`A form with slug "${slug}" already exists in this workspace`);
    this.name = "SlugConflictError";
  }
}

export class RlsPolicyError extends Error {
  constructor(table: string) {
    super(
      `Permission denied on "${table}". Your session may be stale — ` +
        `please refresh the page and try again.`,
    );
    this.name = "RlsPolicyError";
  }
}

/** Detect Supabase RLS violation errors (code 42501 or the text hint). */
function isRlsViolation(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "42501" ||
    (error.message ?? "").includes("row-level security")
  );
}

// ─── List forms ─────────────────────────────────────────────
export async function listForms(): Promise<FormSummary[]> {
  const ctx = await requireWorkspace();
  const supabase = ctx.jwtStale
    ? createAdminSupabase()
    : await createServerSupabase();

  const { data, error } = await supabase
    .from("forms")
    .select(
      "id, title, slug, status, created_at, updated_at, published_at, form_fields(count)",
    )
    .eq("workspace_id", ctx.workspace.id)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`listForms: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    status: row.status,
    // PostgREST aggregate shape: `form_fields: [{ count: number }]`
    fieldCount:
      Array.isArray(row.form_fields) && row.form_fields[0]
        ? (row.form_fields[0] as { count: number }).count
        : 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
  }));
}

// ─── Get one form ──────────────────────────────────────────
export async function getForm(id: string): Promise<FormDetail> {
  const ctx = await requireWorkspace();
  const supabase = ctx.jwtStale
    ? createAdminSupabase()
    : await createServerSupabase();

  const { data, error } = await supabase
    .from("forms")
    .select("*")
    .eq("workspace_id", ctx.workspace.id)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`getForm: ${error.message}`);
  if (!data) throw new FormNotFoundError(id);

  return toFormDetail(data);
}

// ─── Create form ──────────────────────────────────────────
export async function createForm(input: FormCreateInput): Promise<FormDetail> {
  const ctx = await requireWorkspace();
  const parsed = formCreateSchema.parse(input);

  // Plan gate: bail before we take the slug + write the row.
  await assertCanCreateForm(ctx.workspace.id, ctx.workspace.plan);

  // Pick the right client: user-scoped (RLS) when the JWT is
  // healthy, admin (service-role) when the JWT is stale (e.g. right
  // after signup). The admin path is safe because requireWorkspace()
  // already verified workspace membership above.
  const supabase = ctx.jwtStale
    ? createAdminSupabase()
    : await createServerSupabase();

  const slug = await resolveUniqueSlug(
    supabase,
    ctx.workspace.id,
    parsed.slug ?? titleToSlug(parsed.title),
  );

  const payload: TablesInsert<"forms"> = {
    workspace_id: ctx.workspace.id,
    title: parsed.title,
    slug,
    theme: (parsed.theme ?? DEFAULT_THEME) as unknown as Json,
    submit_button_label: parsed.submitButtonLabel ?? "Submit",
    success_message:
      parsed.successMessage ?? "Thanks! We'll be in touch.",
  };

  const { data, error } = await supabase
    .from("forms")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new SlugConflictError(slug);
    }
    if (isRlsViolation(error)) {
      throw new RlsPolicyError("forms");
    }
    throw new Error(`createForm: ${error.message}`);
  }

  // Create any initial fields the caller passed in.
  if (parsed.fields && parsed.fields.length > 0) {
    const fieldRows: TablesInsert<"form_fields">[] = parsed.fields.map(
      (f, i) => ({
        form_id: data.id,
        workspace_id: ctx.workspace.id,
        type: f.type,
        label: f.label,
        placeholder: f.placeholder ?? null,
        help_text: f.helpText ?? null,
        required: f.required,
        options: (f.options ?? []) as unknown as Json,
        step_index: f.stepIndex,
        display_order: f.displayOrder ?? i,
      }),
    );
    const { error: fieldError } = await supabase
      .from("form_fields")
      .insert(fieldRows);
    if (fieldError) {
      if (isRlsViolation(fieldError)) {
        throw new RlsPolicyError("form_fields");
      }
      throw new Error(`createForm fields: ${fieldError.message}`);
    }
  }

  return toFormDetail(data);
}

// ─── Update form ──────────────────────────────────────────
export async function updateForm(
  id: string,
  patch: FormUpdateInput,
): Promise<FormDetail> {
  const ctx = await requireWorkspace();
  const parsed = formUpdateSchema.parse(patch);

  const supabase = ctx.jwtStale
    ? createAdminSupabase()
    : await createServerSupabase();

  const { data, error } = await supabase
    .from("forms")
    .update({
      ...(parsed.title !== undefined && { title: parsed.title }),
      ...(parsed.slug !== undefined && { slug: parsed.slug }),
      ...(parsed.theme !== undefined && {
        theme: parsed.theme as unknown as Json,
      }),
      ...(parsed.submitButtonLabel !== undefined && {
        submit_button_label: parsed.submitButtonLabel,
      }),
      ...(parsed.successMessage !== undefined && {
        success_message: parsed.successMessage,
      }),
      ...(parsed.autoReplyEnabled !== undefined && {
        auto_reply_enabled: parsed.autoReplyEnabled,
      }),
      ...(parsed.autoReplyTemplate !== undefined && {
        auto_reply_template: parsed.autoReplyTemplate,
      }),
      ...(parsed.connectedInboxId !== undefined && {
        connected_inbox_id: parsed.connectedInboxId,
      }),
    })
    .eq("workspace_id", ctx.workspace.id)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) {
    if (isRlsViolation(error)) throw new RlsPolicyError("forms");
    throw new Error(`updateForm: ${error.message}`);
  }
  if (!data) throw new FormNotFoundError(id);

  return toFormDetail(data);
}

// ─── Delete form ──────────────────────────────────────────
export async function deleteForm(id: string): Promise<void> {
  const ctx = await requireWorkspace();
  const supabase = ctx.jwtStale
    ? createAdminSupabase()
    : await createServerSupabase();

  const { error, count } = await supabase
    .from("forms")
    .delete({ count: "exact" })
    .eq("workspace_id", ctx.workspace.id)
    .eq("id", id);

  if (error) {
    if (isRlsViolation(error)) throw new RlsPolicyError("forms");
    throw new Error(`deleteForm: ${error.message}`);
  }
  if (count === 0) throw new FormNotFoundError(id);
}

// ─── Ensure slug is unique in the workspace ───────────────
type SupabaseLike = ReturnType<typeof createServerSupabase> extends Promise<
  infer C
>
  ? C
  : never;

async function resolveUniqueSlug(
  supabase: SupabaseLike | ReturnType<typeof createAdminSupabase>,
  workspaceId: string,
  base: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("forms")
    .select("slug")
    .eq("workspace_id", workspaceId)
    .ilike("slug", `${base}%`);
  if (error) throw new Error(`resolveUniqueSlug: ${error.message}`);

  const taken = new Set((data ?? []).map((r: { slug: string }) => r.slug));
  if (!taken.has(base)) return base;

  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error("resolveUniqueSlug: exhausted suffix range");
}

// ─── Row → DTO mapper ─────────────────────────────────────
export function toFormDetail(row: Tables<"forms">): FormDetail {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    status: row.status,
    // field count isn't selected by single-row queries, so default to 0
    // and let the caller re-fetch fields if they need them.
    fieldCount: 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
    theme: parseTheme(row.theme),
    submitButtonLabel: row.submit_button_label,
    successMessage: row.success_message,
    autoReplyEnabled: row.auto_reply_enabled,
    autoReplyTemplate: row.auto_reply_template,
    connectedInboxId: row.connected_inbox_id,
  };
}

// Re-export so callers can narrow redirects cleanly.
export { NoWorkspaceError };
