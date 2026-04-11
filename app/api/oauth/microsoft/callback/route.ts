import { NextResponse, type NextRequest } from "next/server";

import { verifyOAuthState } from "@/features/integrations/application/tokens";
import { upsertIntegrationTokens } from "@/features/integrations/application/integrations.service";
import { writeAuditLog } from "@/features/audit/application/audit.service";

const TOKEN_URL =
  "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const USERINFO_URL = "https://graph.microsoft.com/v1.0/me";

interface TokenResponse {
  readonly access_token: string;
  readonly refresh_token?: string;
  readonly expires_in: number;
  readonly scope: string;
  readonly token_type: string;
}

interface GraphMeResponse {
  readonly id: string;
  readonly mail?: string;
  readonly userPrincipalName?: string;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/integrations?error=${encodeURIComponent(error)}`, req.url),
    );
  }
  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/integrations?error=missing_params", req.url),
    );
  }

  const verified = verifyOAuthState(state);
  if (!verified || verified.p !== "microsoft") {
    return NextResponse.redirect(
      new URL("/integrations?error=bad_state", req.url),
    );
  }

  const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.MICROSOFT_OAUTH_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.redirect(
      new URL("/integrations?error=not_configured", req.url),
    );
  }

  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    return NextResponse.redirect(
      new URL("/integrations?error=token_exchange_failed", req.url),
    );
  }
  const tokens = (await tokenRes.json()) as TokenResponse;

  const meRes = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const me = meRes.ok
    ? ((await meRes.json()) as GraphMeResponse)
    : { id: "unknown", mail: null, userPrincipalName: null };

  const email = me.mail ?? me.userPrincipalName ?? null;
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  const integrationId = await upsertIntegrationTokens({
    workspaceId: verified.w,
    connectedBy: verified.u,
    provider: "microsoft",
    providerAccountId: me.id,
    accountEmail: email,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    tokenExpiresAt: expiresAt,
    scopes: tokens.scope.split(" "),
  });

  await writeAuditLog({
    workspaceId: verified.w,
    userId: verified.u,
    action: "integration.connected",
    entityType: "integration",
    entityId: integrationId,
    metadata: { provider: "microsoft", email },
  });

  return NextResponse.redirect(
    new URL("/integrations?connected=microsoft", req.url),
  );
}
