import { NextResponse, type NextRequest } from "next/server";

import { verifyStripeSignature } from "@/infrastructure/stripe/client";
import { planFromStripePriceId, type PlanId } from "@/features/billing/application/plans";
import { createAdminSupabase } from "@/infrastructure/supabase/admin";
import { writeAuditLog } from "@/features/audit/application/audit.service";

/**
 * Stripe webhook handler. Verifies the signature first (never trust
 * the request body until you've checked `Stripe-Signature`) then
 * dispatches on `event.type`.
 *
 * Handled events:
 *   - `checkout.session.completed` — workspace just paid, update plan
 *     + stripe_customer_id
 *   - `customer.subscription.updated` — plan changed / price switched
 *   - `customer.subscription.deleted` — subscription canceled, revert
 *     workspace to free
 */

export const dynamic = "force-dynamic";

interface StripeEvent {
  readonly id: string;
  readonly type: string;
  readonly data: { readonly object: Record<string, unknown> };
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }

  const rawBody = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!verifyStripeSignature(rawBody, sig, secret)) {
    return NextResponse.json(
      { error: "signature_invalid" },
      { status: 400 },
    );
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody) as StripeEvent;
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object);
        break;
      default:
        // Log unhandled events at debug level so we can tail them,
        // but return 200 so Stripe doesn't retry forever.
        break;
    }
  } catch (err) {
    console.error("stripe webhook handler error:", err);
    return NextResponse.json({ error: "handler_failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(
  obj: Record<string, unknown>,
): Promise<void> {
  const metadata = (obj.metadata ?? {}) as Record<string, string>;
  const workspaceId = metadata.workspace_id;
  const customerId =
    typeof obj.customer === "string" ? obj.customer : null;

  if (!workspaceId) return;

  const admin = createAdminSupabase();
  // We don't yet know the plan (subscription.updated will give us the
  // price). But we can lock in the customer id so future portal calls
  // work.
  if (customerId) {
    await admin
      .from("workspaces")
      .update({ stripe_customer_id: customerId })
      .eq("id", workspaceId);
  }
  await writeAuditLog({
    workspaceId,
    userId: null,
    action: "billing.checkout_completed",
    metadata: { customer_id: customerId },
  });
}

interface SubscriptionItem {
  readonly price?: { readonly id?: string };
}
interface SubscriptionObject {
  readonly metadata?: Record<string, string>;
  readonly customer?: string;
  readonly items?: { readonly data?: readonly SubscriptionItem[] };
}

async function handleSubscriptionUpdated(
  obj: Record<string, unknown>,
): Promise<void> {
  const sub = obj as SubscriptionObject;
  const workspaceId = sub.metadata?.workspace_id;
  const priceId = sub.items?.data?.[0]?.price?.id;
  if (!workspaceId || !priceId) return;

  const plan: PlanId = planFromStripePriceId(priceId) ?? "free";
  const admin = createAdminSupabase();
  await admin
    .from("workspaces")
    .update({
      plan,
      stripe_customer_id: sub.customer ?? undefined,
    })
    .eq("id", workspaceId);

  await writeAuditLog({
    workspaceId,
    userId: null,
    action: "billing.plan_changed",
    metadata: { plan, price_id: priceId },
  });
}

async function handleSubscriptionDeleted(
  obj: Record<string, unknown>,
): Promise<void> {
  const sub = obj as SubscriptionObject;
  const workspaceId = sub.metadata?.workspace_id;
  if (!workspaceId) return;
  const admin = createAdminSupabase();
  await admin
    .from("workspaces")
    .update({ plan: "free" })
    .eq("id", workspaceId);
  await writeAuditLog({
    workspaceId,
    userId: null,
    action: "billing.subscription_canceled",
  });
}
