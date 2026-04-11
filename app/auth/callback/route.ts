import { NextResponse, type NextRequest } from "next/server";

import { createServerSupabase } from "@/infrastructure/supabase/server";

/**
 * PKCE + magic-link callback. Supabase redirects here after the user
 * clicks a confirmation or magic link email. We exchange the `code`
 * param for a session cookie and send them to the dashboard.
 *
 * Deliberately lives outside the (auth) route group so the auth
 * layout (with the marketing left panel) doesn't wrap a bare redirect.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing-code`);
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
}
