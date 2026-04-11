import { NextResponse, type NextRequest } from "next/server";

import { requireWorkspace } from "@/lib/auth/requireWorkspace";
import { createBillingPortalSession } from "@/infrastructure/stripe/client";
import { createAdminSupabase } from "@/infrastructure/supabase/admin";

export async function POST(req: NextRequest) {
  const ctx = await requireWorkspace();

  const admin = createAdminSupabase();
  const { data: ws } = await admin
    .from("workspaces")
    .select("stripe_customer_id")
    .eq("id", ctx.workspace.id)
    .maybeSingle();

  if (!ws?.stripe_customer_id) {
    return NextResponse.json(
      { error: "no_stripe_customer" },
      { status: 400 },
    );
  }

  const origin = req.headers.get("origin") ?? new URL(req.url).origin;
  const session = await createBillingPortalSession({
    customerId: ws.stripe_customer_id,
    returnUrl: `${origin}/settings/billing`,
  });

  return NextResponse.json({ url: session.url });
}
