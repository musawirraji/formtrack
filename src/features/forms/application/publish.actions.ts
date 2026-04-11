"use server";

import { revalidatePath } from "next/cache";

import {
  CannotPublishEmptyFormError,
  publishForm,
  unpublishForm,
} from "./publish.service";
import { FormNotFoundError } from "./forms.service";

export interface PublishActionResult {
  readonly ok: boolean;
  readonly error?: string;
  readonly version?: number;
}

export async function publishFormAction(
  _prev: PublishActionResult | null,
  formData: FormData,
): Promise<PublishActionResult> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Missing form id" };

  try {
    const snapshot = await publishForm(id);
    revalidatePath(`/forms/${id}`);
    revalidatePath("/forms");
    return { ok: true, version: snapshot.version };
  } catch (err) {
    if (err instanceof CannotPublishEmptyFormError) {
      return {
        ok: false,
        error: "Add at least one field before publishing.",
      };
    }
    if (err instanceof FormNotFoundError) {
      return { ok: false, error: "Form not found." };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Couldn't publish.",
    };
  }
}

export async function unpublishFormAction(
  _prev: PublishActionResult | null,
  formData: FormData,
): Promise<PublishActionResult> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Missing form id" };
  try {
    await unpublishForm(id);
    revalidatePath(`/forms/${id}`);
    revalidatePath("/forms");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Couldn't unpublish.",
    };
  }
}
