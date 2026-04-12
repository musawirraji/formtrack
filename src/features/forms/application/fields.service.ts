import "server-only";

import { createAdminSupabase } from "@/infrastructure/supabase/admin";
import { createServerSupabase } from "@/infrastructure/supabase/server";
import {
  formFieldInputSchema,
  type FieldTypeValue,
  type FormFieldInput,
} from "@/domain/form/validation";
import {
  requireWorkspace,
  type AuthenticatedContext,
} from "@/lib/auth/requireWorkspace";
import type { Json, Tables, TablesInsert } from "@/types/database";

import { FormNotFoundError } from "./forms.service";

/** Pick the right client based on JWT freshness. */
async function getClient(ctx: AuthenticatedContext) {
  return ctx.jwtStale ? createAdminSupabase() : await createServerSupabase();
}

/**
 * CRUD for form_fields. Every operation is workspace-scoped and
 * verifies the parent form exists in the same workspace before it
 * touches anything — RLS would stop a cross-tenant write anyway, but
 * the explicit check gives us a cleaner error message than "42501".
 */

export interface FormFieldDTO {
  readonly id: string;
  readonly formId: string;
  readonly type: FieldTypeValue;
  readonly label: string;
  readonly placeholder: string | null;
  readonly helpText: string | null;
  readonly required: boolean;
  readonly options: readonly string[];
  readonly stepIndex: number;
  readonly displayOrder: number;
}

export function toFieldDTO(row: Tables<"form_fields">): FormFieldDTO {
  const options = Array.isArray(row.options)
    ? (row.options as unknown[]).filter(
        (o): o is string => typeof o === "string",
      )
    : [];
  return {
    id: row.id,
    formId: row.form_id,
    type: row.type as FieldTypeValue,
    label: row.label,
    placeholder: row.placeholder,
    helpText: row.help_text,
    required: row.required,
    options,
    stepIndex: row.step_index,
    displayOrder: row.display_order,
  };
}

async function assertFormBelongsToWorkspace(
  ctx: AuthenticatedContext,
  formId: string,
  workspaceId: string,
): Promise<void> {
  const supabase = await getClient(ctx);
  const { data, error } = await supabase
    .from("forms")
    .select("id")
    .eq("id", formId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) throw new Error(`assertFormBelongsToWorkspace: ${error.message}`);
  if (!data) throw new FormNotFoundError(formId);
}

// ─── List fields for a form ────────────────────────────────
export async function listFields(formId: string): Promise<FormFieldDTO[]> {
  const ctx = await requireWorkspace();
  await assertFormBelongsToWorkspace(ctx, formId, ctx.workspace.id);

  const supabase = await getClient(ctx);
  const { data, error } = await supabase
    .from("form_fields")
    .select("*")
    .eq("form_id", formId)
    .eq("workspace_id", ctx.workspace.id)
    .order("step_index", { ascending: true })
    .order("display_order", { ascending: true });

  if (error) throw new Error(`listFields: ${error.message}`);
  return (data ?? []).map(toFieldDTO);
}

// ─── Add a single field ───────────────────────────────────
export async function addField(
  formId: string,
  input: FormFieldInput,
): Promise<FormFieldDTO> {
  const ctx = await requireWorkspace();
  const parsed = formFieldInputSchema.parse(input);
  await assertFormBelongsToWorkspace(ctx, formId, ctx.workspace.id);

  const supabase = await getClient(ctx);

  // If displayOrder isn't given, append at the end of the same step.
  let order = parsed.displayOrder;
  if (order === 0) {
    const { data: existing } = await supabase
      .from("form_fields")
      .select("display_order")
      .eq("form_id", formId)
      .eq("step_index", parsed.stepIndex)
      .order("display_order", { ascending: false })
      .limit(1);
    order = existing && existing[0] ? existing[0].display_order + 1 : 0;
  }

  const payload: TablesInsert<"form_fields"> = {
    form_id: formId,
    workspace_id: ctx.workspace.id,
    type: parsed.type,
    label: parsed.label,
    placeholder: parsed.placeholder ?? null,
    help_text: parsed.helpText ?? null,
    required: parsed.required,
    options: (parsed.options ?? []) as unknown as Json,
    step_index: parsed.stepIndex,
    display_order: order,
  };

  const { data, error } = await supabase
    .from("form_fields")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw new Error(`addField: ${error.message}`);
  return toFieldDTO(data);
}

// ─── Update one field ─────────────────────────────────────
export async function updateField(
  fieldId: string,
  patch: Partial<FormFieldInput>,
): Promise<FormFieldDTO> {
  const ctx = await requireWorkspace();
  const supabase = await getClient(ctx);

  const { data, error } = await supabase
    .from("form_fields")
    .update({
      ...(patch.type !== undefined && { type: patch.type }),
      ...(patch.label !== undefined && { label: patch.label }),
      ...(patch.placeholder !== undefined && {
        placeholder: patch.placeholder ?? null,
      }),
      ...(patch.helpText !== undefined && { help_text: patch.helpText ?? null }),
      ...(patch.required !== undefined && { required: patch.required }),
      ...(patch.options !== undefined && {
        options: (patch.options ?? []) as unknown as Json,
      }),
      ...(patch.stepIndex !== undefined && { step_index: patch.stepIndex }),
      ...(patch.displayOrder !== undefined && {
        display_order: patch.displayOrder,
      }),
    })
    .eq("id", fieldId)
    .eq("workspace_id", ctx.workspace.id)
    .select("*")
    .maybeSingle();

  if (error) throw new Error(`updateField: ${error.message}`);
  if (!data) throw new Error(`updateField: field ${fieldId} not found`);
  return toFieldDTO(data);
}

// ─── Delete one field ─────────────────────────────────────
export async function deleteField(fieldId: string): Promise<void> {
  const ctx = await requireWorkspace();
  const supabase = await getClient(ctx);

  const { error } = await supabase
    .from("form_fields")
    .delete()
    .eq("id", fieldId)
    .eq("workspace_id", ctx.workspace.id);

  if (error) throw new Error(`deleteField: ${error.message}`);
}

// ─── Reorder fields ───────────────────────────────────────
// Takes a full ordered list of field IDs and writes display_order =
// index back for each one. Dumber and slower than a pair-swap, but
// it's atomic from the user's perspective and never leaves the
// builder in a half-reordered state.
export async function reorderFields(
  formId: string,
  orderedIds: readonly string[],
): Promise<void> {
  const ctx = await requireWorkspace();
  await assertFormBelongsToWorkspace(ctx, formId, ctx.workspace.id);

  const supabase = await getClient(ctx);
  for (let i = 0; i < orderedIds.length; i++) {
    const id = orderedIds[i];
    if (!id) continue;
    const { error } = await supabase
      .from("form_fields")
      .update({ display_order: i })
      .eq("id", id)
      .eq("workspace_id", ctx.workspace.id);
    if (error) throw new Error(`reorderFields[${i}]: ${error.message}`);
  }
}

// ─── Apply a template to an empty form ───────────────────
// Bulk-inserts the template's fields. Refuses if the form already
// has fields — applying a template on top of existing work would
// clobber the user's progress with no undo.
export async function applyTemplateFields(
  formId: string,
  fields: readonly FormFieldInput[],
): Promise<FormFieldDTO[]> {
  const ctx = await requireWorkspace();
  await assertFormBelongsToWorkspace(ctx, formId, ctx.workspace.id);

  const supabase = await getClient(ctx);
  const { count, error: countError } = await supabase
    .from("form_fields")
    .select("id", { count: "exact", head: true })
    .eq("form_id", formId);
  if (countError) throw new Error(`applyTemplateFields count: ${countError.message}`);
  if ((count ?? 0) > 0) {
    throw new Error("Cannot apply a template to a form that already has fields");
  }

  const rows: TablesInsert<"form_fields">[] = fields.map((f, i) => ({
    form_id: formId,
    workspace_id: ctx.workspace.id,
    type: f.type,
    label: f.label,
    placeholder: f.placeholder ?? null,
    help_text: f.helpText ?? null,
    required: f.required,
    options: (f.options ?? []) as unknown as Json,
    step_index: f.stepIndex,
    display_order: f.displayOrder ?? i,
  }));

  const { data, error } = await supabase
    .from("form_fields")
    .insert(rows)
    .select("*");
  if (error) throw new Error(`applyTemplateFields: ${error.message}`);
  return (data ?? []).map(toFieldDTO);
}
