import "server-only";

/**
 * Tiny Stripe HTTP client. We deliberately avoid importing the full
 * `stripe` SDK to keep the server bundle lean — the only calls we
 * make are `/v1/checkout/sessions` (create), `/v1/billing_portal/sessions`
 * (create), and webhook signature verification. Everything else
 * happens in-dashboard or via the webhook events.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

const STRIPE_API = "https://api.stripe.com/v1";

function getSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return key;
}

async function stripePost<T>(
  path: string,
  params: Record<string, string>,
): Promise<T> {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getSecretKey()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Stripe ${path} ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export interface CheckoutSession {
  readonly id: string;
  readonly url: string;
}

export async function createCheckoutSession(input: {
  priceId: string;
  customerId?: string | null;
  customerEmail?: string | null;
  workspaceId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<CheckoutSession> {
  const params: Record<string, string> = {
    mode: "subscription",
    "line_items[0][price]": input.priceId,
    "line_items[0][quantity]": "1",
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    "metadata[workspace_id]": input.workspaceId,
    "subscription_data[metadata][workspace_id]": input.workspaceId,
    allow_promotion_codes: "true",
  };
  if (input.customerId) {
    params.customer = input.customerId;
  } else if (input.customerEmail) {
    params.customer_email = input.customerEmail;
  }
  return stripePost<CheckoutSession>("/checkout/sessions", params);
}

export interface BillingPortalSession {
  readonly id: string;
  readonly url: string;
}

export async function createBillingPortalSession(input: {
  customerId: string;
  returnUrl: string;
}): Promise<BillingPortalSession> {
  return stripePost<BillingPortalSession>("/billing_portal/sessions", {
    customer: input.customerId,
    return_url: input.returnUrl,
  });
}

/**
 * Verify a Stripe webhook signature. Stripe's algorithm:
 *   - Header: `Stripe-Signature: t=<ts>,v1=<sig>,v1=<sig>`
 *   - Signed payload: `${t}.${rawBody}`
 *   - HMAC-SHA256 with the webhook signing secret, hex-encoded.
 *
 * We don't pull in the Stripe SDK just for this; the whole algorithm
 * fits in ~15 lines.
 */
export function verifyStripeSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  toleranceSec = 300,
): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k, v ?? ""];
    }),
  );
  const ts = parts.t;
  const sig = parts.v1;
  if (!ts || !sig) return false;

  const tsNum = Number(ts);
  if (Number.isNaN(tsNum)) return false;
  if (Math.abs(Date.now() / 1000 - tsNum) > toleranceSec) return false;

  const expected = createHmac("sha256", secret)
    .update(`${ts}.${rawBody}`)
    .digest("hex");

  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
