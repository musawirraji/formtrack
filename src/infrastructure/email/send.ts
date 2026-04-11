import "server-only";

import type {
  DecryptedIntegration,
  IntegrationProvider,
} from "@/features/integrations/application/integrations.service";

/**
 * Outbound email adapter. Given a decrypted integration + a plain
 * text body + recipient, produces a RFC 5322 message and dispatches
 * it through the provider's API.
 *
 * We deliberately keep the output plain text for MVP: no HTML
 * templating, no inline images. Auto-replies are meant to feel
 * personal, not to be marketing emails.
 */

export interface SendEmailInput {
  readonly integration: DecryptedIntegration;
  readonly toEmail: string;
  readonly toName: string | null;
  readonly subject: string;
  readonly body: string;
}

export interface SendEmailResult {
  readonly ok: boolean;
  readonly providerMessageId: string | null;
  readonly error: string | null;
}

export async function sendEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  try {
    switch (input.integration.provider) {
      case "google":
        return await sendViaGmail(input);
      case "microsoft":
        return await sendViaGraph(input);
      default:
        return {
          ok: false,
          providerMessageId: null,
          error: `unsupported provider: ${input.integration.provider as IntegrationProvider}`,
        };
    }
  } catch (err) {
    return {
      ok: false,
      providerMessageId: null,
      error: err instanceof Error ? err.message : "unknown send error",
    };
  }
}

// ─── RFC 5322 builder ───────────────────────────────────────
function buildRfc822(input: SendEmailInput): string {
  const fromName = input.integration.accountEmail ?? "FormTrack";
  const to = input.toName
    ? `"${input.toName.replace(/"/g, "")}" <${input.toEmail}>`
    : input.toEmail;
  const headers = [
    `From: ${fromName}`,
    `To: ${to}`,
    `Subject: ${encodeHeader(input.subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
  ];
  return `${headers.join("\r\n")}\r\n\r\n${input.body}`;
}

function encodeHeader(value: string): string {
  // If the subject contains only ASCII, send as-is.
  if (/^[\x20-\x7e]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function base64url(buf: Buffer | string): string {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// ─── Gmail API ──────────────────────────────────────────────
async function sendViaGmail(input: SendEmailInput): Promise<SendEmailResult> {
  const raw = base64url(buildRfc822(input));
  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.integration.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    return {
      ok: false,
      providerMessageId: null,
      error: `gmail ${res.status}: ${text.slice(0, 200)}`,
    };
  }
  const json = (await res.json()) as { id?: string };
  return { ok: true, providerMessageId: json.id ?? null, error: null };
}

// ─── Microsoft Graph ────────────────────────────────────────
async function sendViaGraph(input: SendEmailInput): Promise<SendEmailResult> {
  const res = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.integration.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        subject: input.subject,
        body: { contentType: "Text", content: input.body },
        toRecipients: [
          {
            emailAddress: {
              address: input.toEmail,
              name: input.toName ?? undefined,
            },
          },
        ],
      },
      saveToSentItems: true,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    return {
      ok: false,
      providerMessageId: null,
      error: `graph ${res.status}: ${text.slice(0, 200)}`,
    };
  }
  // Graph /sendMail returns 202 Accepted with no body and no id.
  return { ok: true, providerMessageId: null, error: null };
}
