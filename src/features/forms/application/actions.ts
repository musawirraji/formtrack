"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { FORM_TEMPLATES, getTemplate, type TemplateKey } from "@/domain/form/templates";

import {
  createForm,
  deleteForm,
  FormNotFoundError,
  SlugConflictError,
} from "./forms.service";

export interface FormActionError {
  readonly ok: false;
  readonly error: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
}

function zodErrors(err: unknown): Readonly<Record<string, string>> | undefined {
  if (err && typeof err === "object" && "issues" in err) {
    const issues = (err as { issues: { path: (string | number)[]; message: string }[] })
      .issues;
    const fieldErrors: Record<string, string> = {};
    for (const issue of issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    return Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined;
  }
  return undefined;
}

// ─── Create form ──────────────────────────────────────────
export async function createFormAction(
  _prev: FormActionError | null,
  formData: FormData,
): Promise<FormActionError> {
  const title = String(formData.get("title") ?? "");
  const slug = formData.get("slug");

  try {
    const form = await createForm({
      title,
      ...(typeof slug === "string" && slug.length > 0 && { slug }),
    });
    revalidatePath("/forms");
    redirect(`/forms/${form.id}`);
  } catch (err) {
    if (err instanceof SlugConflictError) {
      return {
        ok: false,
        error: "That slug is already taken in this workspace.",
        fieldErrors: { slug: "Already taken" },
      };
    }
    const fieldErrors = zodErrors(err);
    return {
      ok: false,
      error: fieldErrors
        ? "Please fix the highlighted fields."
        : err instanceof Error
          ? err.message
          : "Something went wrong creating the form.",
      ...(fieldErrors && { fieldErrors }),
    };
  }
}

// ─── Create from template ────────────────────────────────
// Separate action from the blank-form path so the client can pass just
// a template key, and we can seed the form with the template's title,
// theme, copy, and fields atomically. Falls back to a blank form if
// the key isn't recognized.
export async function createFormFromTemplateAction(
  _prev: FormActionError | null,
  formData: FormData,
): Promise<FormActionError> {
  const rawKey = String(formData.get("templateKey") ?? "");
  const knownKey = FORM_TEMPLATES.find((t) => t.key === rawKey)?.key as
    | TemplateKey
    | undefined;

  try {
    const template = knownKey ? getTemplate(knownKey) : null;

    const form = await createForm(
      template
        ? {
            title: template.defaultFormTitle,
            theme: template.theme,
            submitButtonLabel: template.submitButtonLabel,
            successMessage: template.successMessage,
            fields: template.fields.map((f) => ({ ...f })),
          }
        : { title: "Untitled form" },
    );
    revalidatePath("/forms");
    redirect(`/forms/${form.id}`);
  } catch (err) {
    if (err instanceof SlugConflictError) {
      return {
        ok: false,
        error: "A form with that slug already exists.",
      };
    }
    // Let redirect() propagate (Next throws a special error).
    if (err && typeof err === "object" && "digest" in err) throw err;
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Couldn't create form.",
    };
  }
}

// ─── Delete form ──────────────────────────────────────────
export async function deleteFormAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  try {
    await deleteForm(id);
  } catch (err) {
    if (err instanceof FormNotFoundError) {
      // idempotent — already gone
    } else {
      throw err;
    }
  }
  revalidatePath("/forms");
  redirect("/forms");
}
