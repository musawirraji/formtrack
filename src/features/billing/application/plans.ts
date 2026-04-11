/**
 * Plan catalog + gates. The source of truth for what each plan
 * costs, what limits it has, and what Stripe price ID corresponds
 * to it. Stripe price IDs come from env vars so the same deploy can
 * point at test and live Stripe accounts without code changes.
 */

export type PlanId = "free" | "starter" | "growth" | "business";

export interface PlanLimits {
  readonly maxForms: number;
  readonly maxSubmissionsPerMonth: number;
  readonly maxInboxes: number;
  readonly maxTeamMembers: number;
  readonly customDomain: boolean;
}

export interface Plan {
  readonly id: PlanId;
  readonly name: string;
  readonly monthlyPriceUsd: number;
  readonly stripePriceEnv: string | null;
  readonly limits: PlanLimits;
  readonly features: readonly string[];
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    monthlyPriceUsd: 0,
    stripePriceEnv: null,
    limits: {
      maxForms: 1,
      maxSubmissionsPerMonth: 50,
      maxInboxes: 0,
      maxTeamMembers: 1,
      customDomain: false,
    },
    features: [
      "1 form",
      "50 submissions / mo",
      "FormTrack branding",
      "Attribution dashboard",
    ],
  },
  starter: {
    id: "starter",
    name: "Starter",
    monthlyPriceUsd: 19,
    stripePriceEnv: "STRIPE_PRICE_STARTER",
    limits: {
      maxForms: 5,
      maxSubmissionsPerMonth: 500,
      maxInboxes: 1,
      maxTeamMembers: 2,
      customDomain: false,
    },
    features: [
      "5 forms",
      "500 submissions / mo",
      "1 connected inbox",
      "Auto-replies",
      "No FormTrack branding",
    ],
  },
  growth: {
    id: "growth",
    name: "Growth",
    monthlyPriceUsd: 49,
    stripePriceEnv: "STRIPE_PRICE_GROWTH",
    limits: {
      maxForms: 25,
      maxSubmissionsPerMonth: 5000,
      maxInboxes: 3,
      maxTeamMembers: 5,
      customDomain: true,
    },
    features: [
      "25 forms",
      "5,000 submissions / mo",
      "3 connected inboxes",
      "Custom domain",
      "Attribution reports",
    ],
  },
  business: {
    id: "business",
    name: "Business",
    monthlyPriceUsd: 149,
    stripePriceEnv: "STRIPE_PRICE_BUSINESS",
    limits: {
      maxForms: 999,
      maxSubmissionsPerMonth: 50_000,
      maxInboxes: 10,
      maxTeamMembers: 25,
      customDomain: true,
    },
    features: [
      "Unlimited forms",
      "50,000 submissions / mo",
      "10 connected inboxes",
      "Team seats",
      "Priority support",
    ],
  },
};

export const ORDERED_PLANS: readonly Plan[] = [
  PLANS.free,
  PLANS.starter,
  PLANS.growth,
  PLANS.business,
];

export function getPlanLimits(plan: PlanId): PlanLimits {
  return PLANS[plan].limits;
}

/** Resolve a Stripe price ID from env for a plan, if any. */
export function getStripePriceId(plan: PlanId): string | null {
  const envKey = PLANS[plan].stripePriceEnv;
  if (!envKey) return null;
  return process.env[envKey] ?? null;
}

/**
 * Map a Stripe price ID back to a plan. Used by the webhook when
 * Stripe tells us a subscription started/changed and we need to
 * figure out which internal plan to bump the workspace to.
 */
export function planFromStripePriceId(priceId: string): PlanId | null {
  for (const plan of ORDERED_PLANS) {
    if (plan.stripePriceEnv && process.env[plan.stripePriceEnv] === priceId) {
      return plan.id;
    }
  }
  return null;
}
