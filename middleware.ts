import type { NextRequest } from "next/server";

import { updateSupabaseSession } from "@/infrastructure/supabase/middleware";

export function middleware(request: NextRequest) {
  return updateSupabaseSession(request);
}

export const config = {
  // Run on everything except static assets, images, and the public
  // embed route (which must stay cache-friendly and cookie-free so
  // the same embed bundle is served from a CDN).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|embed/|images/|fonts/|api/embed).*)",
  ],
};
