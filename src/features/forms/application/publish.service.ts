import "server-only";

import { createServerSupabase } from "@/infrastructure/supabase/server";
import { createAdminSupabase } from "@/infrastructure/supabase/admin";
import { parseTheme } from "@/domain/form/theme";
import {
  buildSnapshot,
  type FormSnapshot,
  type FormSnapshotField,
} from "@/domain/form/snapshot";
import { requireWorkspace } from "@/lib/auth/requireWorkspace";
import type { Json, Tables } from "@/types/database";

import {
  FormNotFoundError,
  toFormDetail,
} from "./forms.service";
import { toFieldDTO } from "./fields.service";

/**
 * Publish-time snapshotting. Every time a form transitions to
 * `published`, we freeze its current fields + theme + copy into a
 * `form_versions` row. The embed script and submission API only ever
 * read from the latest version — editing a draft never breaks a live
 * embed.
 *
 * Version numbers are per-form and monotonic. We compute the next
 * number from `max(version) + 1` inside the same transaction-ish
 * sequence so concurrent publishes produce distinct versions (the
 * unique (form_id, version) constraint enforces correctness).
 */

export class CannotPublishEmptyFormError extends Error {
  constructor(formId: string) {
    super(`Form ${formId} has no fields to publish`);
    this.name = "CannotPublishEmptyFormError";
  }
}

export class FormNotPublishedError extends Error {
  constructor(public readonly id: string) {
    super(`Form ${id} has no published version`);
    this.name = "FormNotPublishedError";
  }
}

// ─── Publish a form ────────────────────────────────────────
export async function publishForm(formId: string): Promise<FormSnapshot> {
  const ctx = await requireWorkspace();
  const supabase = await createServerSupabase();

  // Load form + fields under RLS.
  const { data: formRow, error: formError } = await supabase
    .from("forms")
    .select("*")
    .eq("id", formId)
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle();
  if (formError) throw new Error(`publishForm form: ${formError.message}`);
  if (!formRow) throw new FormNotFoundError(formId);

  const { data: fieldRows, error: fieldError } = await supabase
    .from("form_fields")
    .select("*")
    .eq("form_id", formId)
    .eq("workspace_id", ctx.workspace.id)
    .order("step_index", { ascending: true })
    .order("display_order", { ascending: true });
  if (fieldError) throw new Error(`publishForm fields: ${fieldError.message}`);
  if (!fieldRows || fieldRows.length === 0) {
    throw new CannotPublishEmptyFormError(formId);
  }

  // Compute next version.
  const { data: versionRows, error: versionError } = await supabase
    .from("form_versions")
    .select("version")
    .eq("form_id", formId)
    .order("version", { ascending: false })
    .limit(1);
  if (versionError) throw new Error(`publishForm version: ${versionError.message}`);
  const nextVersion = (versionRows?.[0]?.version ?? 0) + 1;

  const fields: FormSnapshotField[] = fieldRows.map((row) => {
    const dto = toFieldDTO(row);
    return {
      id: dto.id,
      type: dto.type,
      label: dto.label,
      placeholder: dto.placeholder,
      helpText: dto.helpText,
      required: dto.required,
      options: dto.options,
      stepIndex: dto.stepIndex,
      displayOrder: dto.displayOrder,
    };
  });

  const publishedAt = new Date().toISOString();
  const snapshot = buildSnapshot({
    formId: formRow.id,
    workspaceId: formRow.workspace_id,
    slug: formRow.slug,
    title: formRow.title,
    theme: parseTheme(formRow.theme),
    submitButtonLabel: formRow.submit_button_label,
    successMessage: formRow.success_message,
    fields,
    version: nextVersion,
    publishedAt,
  });

  // Insert the version row first. If someone concurrently publishes
  // the same form the unique (form_id, version) constraint will fail
  // and we surface a clear error instead of silently clobbering.
  const { error: insertError } = await supabase
    .from("form_versions")
    .insert({
      form_id: formId,
      workspace_id: ctx.workspace.id,
      version: nextVersion,
      snapshot: snapshot as unknown as Json,
      published_by: ctx.userId,
      published_at: publishedAt,
    });
  if (insertError) {
    if (insertError.code === "23505") {
      throw new Error(
        "Another publish happened at the same time — try again in a second.",
      );
    }
    throw new Error(`publishForm insert: ${insertError.message}`);
  }

  // Flip the form to published.
  const { error: updateError } = await supabase
    .from("forms")
    .update({ status: "published", published_at: publishedAt })
    .eq("id", formId)
    .eq("workspace_id", ctx.workspace.id);
  if (updateError) throw new Error(`publishForm flip: ${updateError.message}`);

  return snapshot;
}

// ─── Unpublish ─────────────────────────────────────────────
export async function unpublishForm(formId: string): Promise<void> {
  const ctx = await requireWorkspace();
  const supabase = await createServerSupabase();

  const { error } = await supabase
    .from("forms")
    .update({ status: "draft" })
    .eq("id", formId)
    .eq("workspace_id", ctx.workspace.id);
  if (error) throw new Error(`unpublishForm: ${error.message}`);

  // Note: we intentionally leave the form_versions rows in place.
  // Unpublishing hides the embed but preserves history.
}

// ─── List version history ─────────────────────────────────
export interface FormVersionSummary {
  readonly id: string;
  readonly version: number;
  readonly publishedAt: string;
  readonly publishedBy: string | null;
}

export async function listVersions(formId: string): Promise<FormVersionSummary[]> {
  const ctx = await requireWorkspace();
  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from("form_versions")
    .select("id, version, published_at, published_by")
    .eq("form_id", formId)
    .eq("workspace_id", ctx.workspace.id)
    .order("version", { ascending: false });
  if (error) throw new Error(`listVersions: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id,
    version: row.version,
    publishedAt: row.published_at,
    publishedBy: row.published_by,
  }));
}

// ─── Public snapshot lookup (for embed + submission API) ──
// Runs via the admin client so unauthenticated embed requests can
// read a published snapshot. We only return rows where the parent
// form is currently `published`, so unpublishing a form takes its
// snapshot offline immediately.
export async function getPublishedSnapshot(
  workspaceSlug: string,
  formSlug: string,
): Promise<FormSnapshot> {
  const admin = createAdminSupabase();

  const { data: workspace, error: wsError } = await admin
    .from("workspaces")
    .select("id, slug")
    .eq("slug", workspaceSlug)
    .maybeSingle();
  if (wsError) throw new Error(`getPublishedSnapshot workspace: ${wsError.message}`);
  if (!workspace) throw new FormNotPublishedError(`${workspaceSlug}/${formSlug}`);

  const { data: form, error: formError } = await admin
    .from("forms")
    .select("id, status")
    .eq("workspace_id", workspace.id)
    .eq("slug", formSlug)
    .maybeSingle();
  if (formError) throw new Error(`getPublishedSnapshot form: ${formError.message}`);
  if (!form || form.status !== "published") {
    throw new FormNotPublishedError(`${workspaceSlug}/${formSlug}`);
  }

  const { data: version, error: versionError } = await admin
    .from("form_versions")
    .select("snapshot")
    .eq("form_id", form.id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (versionError) throw new Error(`getPublishedSnapshot version: ${versionError.message}`);
  if (!version) throw new FormNotPublishedError(`${workspaceSlug}/${formSlug}`);

  return version.snapshot as unknown as FormSnapshot;
}

// ─── Admin: load form + status for submission API ────────
export async function loadFormForSubmission(
  workspaceSlug: string,
  formSlug: string,
): Promise<{
  readonly workspaceId: string;
  readonly form: Tables<"forms">;
  readonly snapshot: FormSnapshot;
}> {
  const admin = createAdminSupabase();
  const { data: workspace, error: wsError } = await admin
    .from("workspaces")
    .select("id")
    .eq("slug", workspaceSlug)
    .maybeSingle();
  if (wsError) throw new Error(`loadForm workspace: ${wsError.message}`);
  if (!workspace) throw new FormNotPublishedError(`${workspaceSlug}/${formSlug}`);

  const { data: form, error: formError } = await admin
    .from("forms")
    .select("*")
    .eq("workspace_id", workspace.id)
    .eq("slug", formSlug)
    .maybeSingle();
  if (formError) throw new Error(`loadForm form: ${formError.message}`);
  if (!form || form.status !== "published") {
    throw new FormNotPublishedError(`${workspaceSlug}/${formSlug}`);
  }

  const snapshot = await getPublishedSnapshot(workspaceSlug, formSlug);
  return { workspaceId: workspace.id, form, snapshot };
}

// Re-export the detail mapper so consumers can hydrate from a row.
export { toFormDetail };
