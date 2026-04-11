import "server-only";

import { createHash } from "node:crypto";

import { createAdminSupabase } from "@/infrastructure/supabase/admin";
import { resolveAttribution } from "@/domain/lead/attribution";
import type {
  AttributionPayload,
  AttributionSource,
} from "@/domain/lead/Lead";
import type { FormSnapshot } from "@/domain/form/snapshot";
import type { Json } from "@/types/database";

/**
 * Server-side submission pipeline. Runs on the admin client because
 * visitors submitting a form are unauthenticated — the `leads` table
 * deliberately has no INSERT RLS policy (see 0006_rls_policies.sql),
 * so the API route here is the only sanctioned write path.
 *
 * Responsibilities:
 *   1. Validate the submitted values against the published snapshot
 *      (not the current draft — that's the whole point of versions).
 *   2. Promote contact fields (email / name / phone) to top-level
 *      columns for fast dashboard rendering.
 *   3. Run the pure attribution resolver and store normalized + raw
 *      outputs inline.
 *   4. Hash the client IP (never store raw).
 *   5. Write one row into `public.leads`.
 */

export interface SubmissionInput {
  readonly values: Record<string, string | string[]>;
  readonly attribution: AttributionPayload;
  /** The snapshot version the embed script was rendering, for telemetry. */
  readonly snapshotVersion?: number;
}

export interface SubmissionContext {
  readonly ip: string | null;
  readonly userAgent: string | null;
  readonly country: string | null;
}

export class SubmissionValidationError extends Error {
  readonly fieldErrors: Readonly<Record<string, string>>;
  constructor(fieldErrors: Readonly<Record<string, string>>) {
    super("Submission failed validation");
    this.name = "SubmissionValidationError";
    this.fieldErrors = fieldErrors;
  }
}

export interface SubmissionResult {
  readonly leadId: string;
  readonly source: AttributionSource;
}

/**
 * Validate, normalize, and persist a submission. Throws
 * `SubmissionValidationError` for field-level failures so the API
 * route can return a 422 with per-field errors.
 */
export async function submitLead(
  snapshot: FormSnapshot,
  input: SubmissionInput,
  ctx: SubmissionContext,
): Promise<SubmissionResult> {
  // 1. Validate values against the snapshot schema.
  const fieldErrors = validateAgainstSnapshot(snapshot, input.values);
  if (Object.keys(fieldErrors).length > 0) {
    throw new SubmissionValidationError(fieldErrors);
  }

  // 2. Promote contact fields. We look for the first email / phone
  // field and the first short_text field labelled "name" (case
  // insensitive) so the dashboard has columns to render without
  // reaching into jsonb.
  const contact = promoteContactFields(snapshot, input.values);

  // 3. Resolve attribution.
  const source = resolveAttribution(input.attribution);

  // 4. IP hashing. SHA-256 with a per-deployment pepper so two
  // installs can't cross-reference the same user.
  const pepper = process.env.FORMTRACK_IP_PEPPER ?? "local-dev-pepper";
  const ipHash = ctx.ip
    ? createHash("sha256").update(`${pepper}:${ctx.ip}`).digest("hex")
    : null;

  // 5. Insert via the admin client.
  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("leads")
    .insert({
      workspace_id: snapshot.workspaceId,
      form_id: snapshot.formId,
      values: input.values as unknown as Json,
      email: contact.email,
      name: contact.name,
      phone: contact.phone,
      source_channel: source.channel,
      source_label: source.label,
      source_campaign: source.campaign,
      source_referrer_host: source.referrerHost,
      source_explanation: source.explanation,
      source_confidence: source.confidence,
      attribution_raw: input.attribution as unknown as Json,
      ip_hash: ipHash,
      country: ctx.country,
      user_agent: ctx.userAgent,
    })
    .select("id")
    .single();

  if (error) throw new Error(`submitLead insert: ${error.message}`);

  return { leadId: data.id, source };
}

// ─── Validation ──────────────────────────────────────────
export function validateAgainstSnapshot(
  snapshot: FormSnapshot,
  values: Record<string, string | string[]>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of snapshot.fields) {
    const raw = values[field.id];

    if (field.required) {
      if (raw === undefined || raw === null) {
        errors[field.id] = `${field.label} is required`;
        continue;
      }
      if (Array.isArray(raw)) {
        if (raw.length === 0) {
          errors[field.id] = `${field.label} is required`;
          continue;
        }
      } else if (raw.trim() === "") {
        errors[field.id] = `${field.label} is required`;
        continue;
      }
    }

    if (raw === undefined || raw === null || raw === "") continue;

    switch (field.type) {
      case "email": {
        if (typeof raw === "string" && !isValidEmail(raw)) {
          errors[field.id] = "Please enter a valid email";
        }
        break;
      }
      case "number": {
        if (typeof raw === "string" && Number.isNaN(Number(raw))) {
          errors[field.id] = "Must be a number";
        }
        break;
      }
      case "dropdown":
      case "radio": {
        if (typeof raw === "string" && !field.options.includes(raw)) {
          errors[field.id] = "Pick one of the available options";
        }
        break;
      }
      case "checkbox": {
        const arr = Array.isArray(raw) ? raw : [raw];
        for (const v of arr) {
          if (!field.options.includes(v)) {
            errors[field.id] = "Pick from the available options";
            break;
          }
        }
        break;
      }
      default:
        break;
    }
  }
  return errors;
}

function isValidEmail(s: string): boolean {
  // Deliberately loose — we're not RFC-enforcing here, just sanity
  // checking that there's a local part + @ + domain + TLD.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

function promoteContactFields(
  snapshot: FormSnapshot,
  values: Record<string, string | string[]>,
): { email: string | null; name: string | null; phone: string | null } {
  let email: string | null = null;
  let name: string | null = null;
  let phone: string | null = null;

  for (const field of snapshot.fields) {
    const raw = values[field.id];
    if (typeof raw !== "string" || raw.trim() === "") continue;
    const trimmed = raw.trim();
    if (!email && field.type === "email") email = trimmed;
    if (!phone && field.type === "phone") phone = trimmed;
    if (
      !name &&
      field.type === "short_text" &&
      /name/i.test(field.label)
    ) {
      name = trimmed;
    }
  }
  return { email, name, phone };
}
