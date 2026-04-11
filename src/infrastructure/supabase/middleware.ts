import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/types/database";

/**
 * Next.js middleware helper that refreshes the Supabase session on
 * every request. Supabase's auth cookies rotate, and without this
 * helper Server Components see a stale user after sign-in.
 *
 * This lives in infrastructure (not root middleware.ts) so the
 * Supabase coupling stays in one place. The actual `middleware.ts`
 * at the repo root just imports and re-exports.
 */
export async function updateSupabaseSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    // In dev without .env.local we still want the page to render.
    return response;
  }

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // Refresh the session. We intentionally don't redirect here — route
  // guards live inside the (app) layout via `requireWorkspaceOrRedirect`.
  // Middleware only keeps cookies fresh.
  await supabase.auth.getUser();

  return response;
}
