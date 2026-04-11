"use server";

import { revalidatePath } from "next/cache";

import type { FormFieldInput } from "@/domain/form/validation";
import { getTemplate, type TemplateKey } from "@/domain/form/templates";

import {
  addField,
  applyTemplateFields,
  deleteField,
  reorderFields,
  updateField,
  type FormFieldDTO,
} from "./fields.service";
import { updateForm } from "./forms.service";

/**
 * Server actions for the form builder. Each one validates,
 * delegates to the service, and revalidates the detail page so the
 * next RSC render reflects the write.
 *
 * Actions return success+payload instead of just redirecting so the
 * client-side builder can merge the authoritative row back into
 * local state without a round-trip.
 */

export interface ActionSuccess<T> {
  readonly ok: true;
  readonly data: T;
}
export interface ActionFailure {
  readonly ok: false;
  readonly error: string;
}
export type ActionResult<T> = ActionSuccess<T> | ActionFailure;

function fail(err: unknown): ActionFailure {
  return {
    ok: false,
    error: err instanceof Error ? err.message : "Unknown error",
  };
}

// ─── Add ─────────────────────────────────────────────────
export async function addFieldAction(
  formId: string,
  input: FormFieldInput,
): Promise<ActionResult<FormFieldDTO>> {
  try {
    const field = await addField(formId, input);
    revalidatePath(`/forms/${formId}`);
    return { ok: true, data: field };
  } catch (err) {
    return fail(err);
  }
}

// ─── Update ──────────────────────────────────────────────
export async function updateFieldAction(
  formId: string,
  fieldId: string,
  patch: Partial<FormFieldInput>,
): Promise<ActionResult<FormFieldDTO>> {
  try {
    const field = await updateField(fieldId, patch);
    revalidatePath(`/forms/${formId}`);
    return { ok: true, data: field };
  } catch (err) {
    return fail(err);
  }
}

// ─── Delete ──────────────────────────────────────────────
export async function deleteFieldAction(
  formId: string,
  fieldId: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    await deleteField(fieldId);
    revalidatePath(`/forms/${formId}`);
    return { ok: true, data: { id: fieldId } };
  } catch (err) {
    return fail(err);
  }
}

// ─── Reorder ─────────────────────────────────────────────
export async function reorderFieldsAction(
  formId: string,
  orderedIds: string[],
): Promise<ActionResult<{ orderedIds: string[] }>> {
  try {
    await reorderFields(formId, orderedIds);
    revalidatePath(`/forms/${formId}`);
    return { ok: true, data: { orderedIds } };
  } catch (err) {
    return fail(err);
  }
}

// ─── Apply template ──────────────────────────────────────
export async function applyTemplateAction(
  formId: string,
  templateKey: TemplateKey,
): Promise<ActionResult<{ fields: FormFieldDTO[] }>> {
  try {
    const template = getTemplate(templateKey);
    // Also push the template's theme + submit copy onto the form.
    await updateForm(formId, {
      theme: template.theme,
      submitButtonLabel: template.submitButtonLabel,
      successMessage: template.successMessage,
    });
    const fields = await applyTemplateFields(formId, template.fields);
    revalidatePath(`/forms/${formId}`);
    return { ok: true, data: { fields } };
  } catch (err) {
    return fail(err);
  }
}
