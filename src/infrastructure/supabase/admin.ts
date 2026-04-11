import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Supabase admin client — bypasses RLS via the service role key.
 *
 * CRITICAL: Only use this in:
 *   - Stripe / SendGrid / provider webhooks (signature verified first)
 *   - Cron jobs & background workers
 *   - Migrations & admin scripts
 *
 * Never import this file from any code that is reachable from the browser.
 * If you need user data in an API route, use createServerSupabase() so RLS
 * enforces tenant isolation.
 */
let _admin: ReturnType<typeof createClient<Database>> | null = null;

export function createAdminSupabase() {
  if (_admin) return _admin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY — this client must only be used server-side."
    );
  }

  _admin = createClient<Database>(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return _admin;
}
