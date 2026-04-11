import { NextResponse } from "next/server";

import { createAdminSupabase } from "@/infrastructure/supabase/admin";
import { parseTheme } from "@/domain/form/theme";
import { buildSnapshot, type FormSnapshot } from "@/domain/form/snapshot";
import { toFieldDTO } from "@/features/forms/application/fields.service";
import { FormNotPublishedError } from "@/features/forms/application/publish.service";
import { checkRateLimit } from "@/features/submissions/application/rateLimit";
import {
  submitLead,
  SubmissionValidationError,
} from "@/features/submissions/application/submit.service";
import { queueAutoReply } from "@/features/autoReply/application/autoReply.service";

/**
 * Public submissions endpoint. Accepts a JSON body from the embed
 * script or the hosted page and writes one `leads` row. Runs the
 * attribution resolver server-side so the client can't fake a "high
 * confidence Meta Ads" attribution.
 *
 * Rate-limited per (ip, formId) — see `rateLimit.ts`. No auth cookies
 * are required because `leads` has no user INSERT policy.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

interface Params {
  readonly params: Promise<{ workspaceId: string; formId: string }>;
}

export async function POST(request: Request, { params }: Params) {
  const { workspaceId, formId } = await params;

  // ─── Rate limiting ────────────────────────────────────
  const ip = extractClientIp(request);
  const key = `${ip ?? "anon"}:${formId}`;
  const limit = checkRateLimit(key);
  if (!limit.ok) {
    return NextResponse.json(
      {
        error:
          limit.reason === "burst"
            ? "Too many requests. Slow down for a few seconds."
            : "Too many submissions from this address. Try again in an hour.",
      },
      {
        status: 429,
        headers: {
          ...CORS_HEADERS,
          "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)),
        },
      },
    );
  }

  // ─── Parse body ──────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: CORS_HEADERS },
    );
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: "Body must be an object" },
      { status: 400, headers: CORS_HEADERS },
    );
  }
  const { values, attribution, snapshotVersion } = body as {
    values?: unknown;
    attribution?: unknown;
    snapshotVersion?: unknown;
  };

  if (!values || typeof values !== "object" || Array.isArray(values)) {
    return NextResponse.json(
      { error: "values must be an object" },
      { status: 400, headers: CORS_HEADERS },
    );
  }
  if (!attribution || typeof attribution !== "object") {
    return NextResponse.json(
      { error: "attribution is required" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  // ─── Load the current published snapshot ────────────
  // The embed may have sent a stale `snapshotVersion` — we always
  // validate against the server's latest published snapshot because
  // that's the authoritative schema. If the embed's schema is
  // older, the user's values for removed fields are silently
  // dropped and new required fields trigger a validation error.
  const snapshot = await loadSnapshotByIds(workspaceId, formId).catch(
    () => null,
  );
  if (!snapshot) {
    return NextResponse.json(
      { error: "Form is not currently published" },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  // ─── Run the submission pipeline ─────────────────────
  try {
    const result = await submitLead(
      snapshot,
      {
        values: values as Record<string, string | string[]>,
        attribution: attribution as Parameters<typeof submitLead>[1]["attribution"],
        snapshotVersion: typeof snapshotVersion === "number" ? snapshotVersion : undefined,
      },
      {
        ip,
        userAgent: request.headers.get("user-agent"),
        country: request.headers.get("x-vercel-ip-country"),
      },
    );

    // Fire-and-forget auto-reply. Never blocks the response.
    queueAutoReply({
      workspaceId: snapshot.workspaceId,
      formId: snapshot.formId,
      leadId: result.leadId,
    }).catch((err) => console.error("[auto-reply] queue error:", err));

    return NextResponse.json(
      { ok: true, leadId: result.leadId, source: result.source },
      { status: 201, headers: CORS_HEADERS },
    );
  } catch (err) {
    if (err instanceof SubmissionValidationError) {
      return NextResponse.json(
        { error: "Validation failed", fieldErrors: err.fieldErrors },
        { status: 422, headers: CORS_HEADERS },
      );
    }
    if (err instanceof FormNotPublishedError) {
      return NextResponse.json(
        { error: "Form is not currently published" },
        { status: 404, headers: CORS_HEADERS },
      );
    }
    console.error("[submissions] unexpected error:", err);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}

// ─── Helpers ──────────────────────────────────────────

function extractClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("cf-connecting-ip") ??
    null
  );
}

// Loads the latest published snapshot by (workspaceId, formId).
// Mirrors `getPublishedSnapshot` but takes ids instead of slugs so
// the embed script doesn't need to remember the workspace slug.
async function loadSnapshotByIds(
  workspaceId: string,
  formId: string,
): Promise<FormSnapshot | null> {
  const admin = createAdminSupabase();

  const { data: form } = await admin
    .from("forms")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", formId)
    .maybeSingle();
  if (!form || form.status !== "published") return null;

  const { data: version } = await admin
    .from("form_versions")
    .select("snapshot")
    .eq("form_id", formId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (version?.snapshot) return version.snapshot as unknown as FormSnapshot;

  // Fallback: if for some reason there's no version row but the form
  // is marked published, re-build one on the fly from the current
  // rows. Should not happen in practice but keeps the endpoint
  // resilient against partially-completed publishes.
  const { data: fields } = await admin
    .from("form_fields")
    .select("*")
    .eq("form_id", formId)
    .order("step_index", { ascending: true })
    .order("display_order", { ascending: true });

  return buildSnapshot({
    formId: form.id,
    workspaceId: form.workspace_id,
    slug: form.slug,
    title: form.title,
    theme: parseTheme(form.theme),
    submitButtonLabel: form.submit_button_label,
    successMessage: form.success_message,
    fields: (fields ?? []).map((row) => {
      const dto = toFieldDTO(row);
      return {
        id: dto.id,
        type: dto.type,
        label: dto.label,
        placeholder: dto.placeholder,
        helpText: dto.helpText,
        required: dto.required,
        options: dto.options,
        stepIndex: dto.stepIndex,
        displayOrder: dto.displayOrder,
      };
    }),
    version: 0,
    publishedAt: form.published_at ?? new Date().toISOString(),
  });
}
