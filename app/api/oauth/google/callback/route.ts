import { NextResponse, type NextRequest } from "next/server";

import { verifyOAuthState } from "@/features/integrations/application/tokens";
import { upsertIntegrationTokens } from "@/features/integrations/application/integrations.service";
import { writeAuditLog } from "@/features/audit/application/audit.service";

/**
 * Google OAuth callback. Exchanges the auth code for tokens, decodes
 * the signed state to verify workspace ownership, and hands off to
 * `upsertIntegrationTokens` which encrypts-at-rest before writing.
 *
 * Errors redirect the user back to /integrations with a query param
 * rather than exploding — OAuth popups are a poor place to render a
 * stack trace.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

interface TokenResponse {
  readonly access_token: string;
  readonly refresh_token?: string;
  readonly expires_in: number;
  readonly scope: string;
  readonly token_type: string;
  readonly id_token?: string;
}

interface UserInfoResponse {
  readonly sub: string;
  readonly email?: string;
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
  if (!verified || verified.p !== "google") {
    return NextResponse.redirect(
      new URL("/integrations?error=bad_state", req.url),
    );
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.redirect(
      new URL("/integrations?error=not_configured", req.url),
    );
  }

  // Exchange code → tokens.
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

  // Fetch user info for account_email + provider_account_id.
  const userRes = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const userInfo = userRes.ok
    ? ((await userRes.json()) as UserInfoResponse)
    : { sub: "unknown", email: null };

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  const integrationId = await upsertIntegrationTokens({
    workspaceId: verified.w,
    connectedBy: verified.u,
    provider: "google",
    providerAccountId: userInfo.sub,
    accountEmail: userInfo.email ?? null,
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
    metadata: { provider: "google", email: userInfo.email ?? null },
  });

  return NextResponse.redirect(new URL("/integrations?connected=google", req.url));
}
