import { NextResponse } from "next/server";

import {
  FormNotPublishedError,
  getPublishedSnapshot,
} from "@/features/forms/application/publish.service";

/**
 * Public snapshot endpoint consumed by the embed script. Returns the
 * latest published `form_versions.snapshot` as JSON, or 404 if the
 * form isn't currently published. Unauthenticated — runs through the
 * admin client on the server side and only exposes the snapshot
 * fields (no tokens, no internal ids beyond what's already public).
 *
 * Cache-Control is aggressive (60s) because snapshots are immutable —
 * a republish bumps the version and the next request gets the new
 * one; a 60s stale window is acceptable.
 *
 * CORS is wide open because customers embed this on any domain.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // we do our own caching via headers

interface Params {
  readonly params: Promise<{ workspace: string; form: string }>;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(_request: Request, { params }: Params) {
  const { workspace, form } = await params;

  try {
    const snapshot = await getPublishedSnapshot(workspace, form);
    return NextResponse.json(snapshot, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        "Cache-Control": "public, max-age=60, s-maxage=60",
      },
    });
  } catch (err) {
    if (err instanceof FormNotPublishedError) {
      return NextResponse.json(
        { error: "Form not published" },
        { status: 404, headers: CORS_HEADERS },
      );
    }
    console.error("[embed] snapshot error:", err);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
