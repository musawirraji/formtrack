"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { inviteMember, removeMember } from "./team.service";
import { PlanLimitError } from "@/features/billing/application/gates";

export interface TeamActionResult {
  readonly ok: boolean;
  readonly error?: string;
  readonly upgradeRequired?: boolean;
}

const inviteSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  role: z.enum(["admin", "member"]),
});

export async function inviteMemberAction(
  _prev: TeamActionResult | null,
  formData: FormData,
): Promise<TeamActionResult> {
  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  try {
    await inviteMember(parsed.data);
    revalidatePath("/settings/team");
    return { ok: true };
  } catch (err) {
    if (err instanceof PlanLimitError) {
      return { ok: false, error: err.message, upgradeRequired: true };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Invite failed.",
    };
  }
}

export async function removeMemberAction(
  _prev: TeamActionResult | null,
  formData: FormData,
): Promise<TeamActionResult> {
  const userId = formData.get("userId");
  if (typeof userId !== "string" || !userId) {
    return { ok: false, error: "Missing user id." };
  }
  try {
    await removeMember(userId);
    revalidatePath("/settings/team");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Remove failed.",
    };
  }
}
