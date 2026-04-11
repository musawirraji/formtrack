"use server";

import { revalidatePath } from "next/cache";

import { updateForm } from "./forms.service";

export interface AutoReplyActionResult {
  readonly ok: boolean;
  readonly error?: string;
}

export async function updateAutoReplyAction(
  _prev: AutoReplyActionResult | null,
  formData: FormData,
): Promise<AutoReplyActionResult> {
  const formId = formData.get("formId");
  if (typeof formId !== "string" || !formId) {
    return { ok: false, error: "Missing form id." };
  }
  const enabled = formData.get("enabled") === "on";
  const rawTemplate = formData.get("template");
  const rawInbox = formData.get("connectedInboxId");

  const template =
    typeof rawTemplate === "string" && rawTemplate.trim() !== ""
      ? rawTemplate
      : null;
  const connectedInboxId =
    typeof rawInbox === "string" && rawInbox !== "" ? rawInbox : null;

  if (enabled && !connectedInboxId) {
    return {
      ok: false,
      error: "Pick an inbox before turning auto-reply on.",
    };
  }
  if (enabled && !template) {
    return { ok: false, error: "Write a message first." };
  }

  try {
    await updateForm(formId, {
      autoReplyEnabled: enabled,
      autoReplyTemplate: template,
      connectedInboxId,
    });
    revalidatePath(`/forms/${formId}/settings`);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Save failed.",
    };
  }
}
