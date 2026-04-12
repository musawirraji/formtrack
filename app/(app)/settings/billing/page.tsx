import type { Metadata } from "next";

import { Badge } from "@/shared/components/Badge";
import { Card } from "@/shared/components/Card";
import { requireWorkspace } from "@/lib/auth/requireWorkspace";
import { ORDERED_PLANS, PLANS } from "@/features/billing/application/plans";

import { PlanButtons } from "./PlanButtons";
import styles from "./page.module.scss";

export const metadata: Metadata = { title: "Billing" };

interface Props {
  readonly searchParams: Promise<{ success?: string; canceled?: string }>;
}

export default async function BillingPage({ searchParams }: Props) {
  const { success, canceled } = await searchParams;
  const ctx = await requireWorkspace();
  const current = PLANS[ctx.workspace.plan];

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <h1 className={styles.title}>Billing</h1>
        <p className={styles.sub}>
          You&apos;re currently on the{" "}
          <strong>{current.name}</strong> plan. Upgrade for more forms,
          submissions, and connected inboxes.
        </p>
      </header>

      {success && (
        <div className={styles.flashOk}>
          Payment confirmed. Your plan will update shortly.
        </div>
      )}
      {canceled && (
        <div className={styles.flashWarn}>
          Checkout canceled. No changes were made.
        </div>
      )}

      <div className={styles.grid}>
        {ORDERED_PLANS.map((plan) => {
          const isCurrent = plan.id === current.id;
          return (
            <Card key={plan.id} className={styles.planCard}>
              <div className={styles.planHead}>
                <h2 className={styles.planName}>{plan.name}</h2>
                {isCurrent && <Badge tone="accent">Current</Badge>}
              </div>
              <div className={styles.price}>
                <span className={styles.priceAmt}>
                  ${plan.monthlyPriceUsd}
                </span>
                <span className={styles.priceUnit}>/mo</span>
              </div>
              <ul className={styles.features}>
                {plan.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <PlanButtons
                planId={plan.id}
                isCurrent={isCurrent}
                isFree={plan.monthlyPriceUsd === 0}
              />
            </Card>
          );
        })}
      </div>
    </div>
  );
}
