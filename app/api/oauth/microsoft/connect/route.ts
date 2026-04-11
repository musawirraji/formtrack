import { NextResponse } from "next/server";

import { requireWorkspace } from "@/lib/auth/requireWorkspace";
import { signOAuthState } from "@/features/integrations/application/tokens";

/**
 * Microsoft (Graph) OAuth connect. Mail.Send + offline_access so we
 * get a refresh token and can keep sending auto-replies after the
 * access token expires.
 */

const MS_AUTH_URL =
  "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const SCOPES = [
  "openid",
  "email",
  "profile",
  "offline_access",
  "https://graph.microsoft.com/Mail.Send",
];

export async function GET() {
  const ctx = await requireWorkspace();

  const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID;
  const redirectUri = process.env.MICROSOFT_OAUTH_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "microsoft_oauth_not_configured" },
      { status: 500 },
    );
  }

  const state = signOAuthState({
    w: ctx.workspace.id,
    u: ctx.userId,
    p: "microsoft",
    n: crypto.randomUUID(),
  });

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope: SCOPES.join(" "),
    state,
  });

  return NextResponse.redirect(`${MS_AUTH_URL}?${params}`);
}
