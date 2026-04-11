import "server-only";

import { createAdminSupabase } from "@/infrastructure/supabase/admin";
import { getDecryptedIntegration } from "@/features/integrations/application/integrations.service";
import { sendEmail } from "@/infrastructure/email/send";

/**
 * Auto-reply queue. Called after a successful lead insert. Looks up
 * the form's auto_reply_enabled + connected_inbox_id + template and,
 * if everything is configured, dispatches an email through the
 * connected Gmail / Graph integration.
 *
 * Fire-and-forget: the API route doesn't await the promise, so a bad
 * integration token or provider outage cannot delay the visitor's
 * submission response.
 */

export interface AutoReplyQueueInput {
  readonly workspaceId: string;
  readonly formId: string;
  readonly leadId: string;
}

export async function queueAutoReply(input: AutoReplyQueueInput): Promise<void> {
  const admin = createAdminSupabase();

  const { data: form } = await admin
    .from("forms")
    .select(
      "id, title, auto_reply_enabled, auto_reply_template, connected_inbox_id",
    )
    .eq("id", input.formId)
    .eq("workspace_id", input.workspaceId)
    .maybeSingle();

  if (!form || !form.auto_reply_enabled) return;
  if (!form.auto_reply_template || !form.connected_inbox_id) {
    await logSkip(input, !form.auto_reply_template ? "missing_template" : "missing_inbox");
    return;
  }

  // Look up the lead's email so we know who to reply to.
  const { data: lead } = await admin
    .from("leads")
    .select("email, name, values, form_id")
    .eq("id", input.leadId)
    .maybeSingle();

  if (!lead?.email) {
    await logSkip(input, "no_email_field");
    return;
  }

  const integration = await getDecryptedIntegration(form.connected_inbox_id);
  if (!integration) {
    await logSkip(input, "integration_inactive");
    return;
  }

  const body = renderTemplate(form.auto_reply_template, {
    name: lead.name ?? "there",
    email: lead.email,
    form: form.title,
  });
  const subject = `Thanks for getting in touch — ${form.title}`;

  const result = await sendEmail({
    integration,
    toEmail: lead.email,
    toName: lead.name,
    subject,
    body,
  });

  await admin.from("audit_log").insert({
    workspace_id: input.workspaceId,
    action: result.ok ? "auto_reply.sent" : "auto_reply.failed",
    resource_type: "lead",
    resource_id: input.leadId,
    metadata: {
      provider: integration.provider,
      from: integration.accountEmail,
      to: lead.email,
      provider_message_id: result.providerMessageId,
      error: result.error,
    },
  });

  // Mark integration as errored if the send failed — helps the
  // /integrations page surface "needs reauth" without a polling job.
  if (!result.ok) {
    await admin
      .from("integrations")
      .update({ status: "error", last_error: result.error })
      .eq("id", integration.id);
  }
}

async function logSkip(
  input: AutoReplyQueueInput,
  reason: string,
): Promise<void> {
  const admin = createAdminSupabase();
  await admin.from("audit_log").insert({
    workspace_id: input.workspaceId,
    action: "auto_reply.skipped",
    resource_type: "lead",
    resource_id: input.leadId,
    metadata: { reason },
  });
}

// Lightweight mustache-style template replacement. Good enough for
// name / email / form substitutions; no nested paths, no partials,
// no escaping (it's plain text for MVP).
export function renderTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
    return vars[key] ?? "";
  });
}
