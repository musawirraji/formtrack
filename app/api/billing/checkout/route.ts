import { NextResponse, type NextRequest } from "next/server";

import { requireWorkspace } from "@/lib/auth/requireWorkspace";
import { createCheckoutSession } from "@/infrastructure/stripe/client";
import { getStripePriceId, type PlanId } from "@/features/billing/application/plans";
import { createAdminSupabase } from "@/infrastructure/supabase/admin";

export async function POST(req: NextRequest) {
  const ctx = await requireWorkspace();
  const { plan } = (await req.json().catch(() => ({}))) as {
    plan?: PlanId;
  };

  if (!plan || plan === "free") {
    return NextResponse.json(
      { error: "invalid_plan" },
      { status: 400 },
    );
  }

  const priceId = getStripePriceId(plan);
  if (!priceId) {
    return NextResponse.json(
      { error: "price_not_configured" },
      { status: 500 },
    );
  }

  // Grab the existing stripe_customer_id if any.
  const admin = createAdminSupabase();
  const { data: ws } = await admin
    .from("workspaces")
    .select("stripe_customer_id")
    .eq("id", ctx.workspace.id)
    .maybeSingle();

  const origin = req.headers.get("origin") ?? new URL(req.url).origin;
  const session = await createCheckoutSession({
    priceId,
    customerId: ws?.stripe_customer_id ?? null,
    customerEmail: ws?.stripe_customer_id ? null : ctx.email,
    workspaceId: ctx.workspace.id,
    successUrl: `${origin}/settings/billing?success=1`,
    cancelUrl: `${origin}/settings/billing?canceled=1`,
  });

  return NextResponse.json({ url: session.url });
}
