import { NextResponse } from "next/server";

import { requireWorkspace } from "@/lib/auth/requireWorkspace";
import { signOAuthState } from "@/features/integrations/application/tokens";

/**
 * Step 1 of the Google OAuth dance. Redirects the user to Google's
 * consent screen with a state token signed by us so the callback can
 * prove the request originated here (CSRF guard).
 *
 * Scopes: gmail.send only — we don't need read access. The connected
 * inbox is used for outbound auto-replies, nothing else.
 */

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/gmail.send",
];

export async function GET() {
  const ctx = await requireWorkspace();

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "google_oauth_not_configured" },
      { status: 500 },
    );
  }

  const state = signOAuthState({
    w: ctx.workspace.id,
    u: ctx.userId,
    p: "google",
    n: crypto.randomUUID(),
  });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: SCOPES.join(" "),
    state,
  });

  return NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params}`);
}
