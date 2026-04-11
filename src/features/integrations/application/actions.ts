"use server";

import { revalidatePath } from "next/cache";

import { disconnectIntegration } from "./integrations.service";
import { writeAuditLog } from "@/features/audit/application/audit.service";
import { requireWorkspace } from "@/lib/auth/requireWorkspace";

export interface IntegrationActionResult {
  readonly ok: boolean;
  readonly error?: string;
}

export async function disconnectIntegrationAction(
  _prev: IntegrationActionResult | null,
  formData: FormData,
): Promise<IntegrationActionResult> {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { ok: false, error: "Missing integration id." };
  }

  try {
    const ctx = await requireWorkspace();
    await disconnectIntegration(id);
    await writeAuditLog({
      workspaceId: ctx.workspace.id,
      userId: ctx.userId,
      action: "integration.disconnected",
      entityType: "integration",
      entityId: id,
    });
    revalidatePath("/integrations");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Disconnect failed.",
    };
  }
}
