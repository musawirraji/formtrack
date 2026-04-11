import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Liveness probe — used by CI smoke test and uptime monitoring.
 * Never touches Supabase; just confirms the Next.js runtime is alive.
 */
export function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: "formtrack",
      time: new Date().toISOString(),
    },
    { status: 200 }
  );
}
