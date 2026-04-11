import type { Metadata } from "next";

import { Card } from "@/shared/components/Card";
import { listAuditLog } from "@/features/audit/application/audit.service";

import styles from "./page.module.scss";

export const metadata: Metadata = { title: "Audit log" };

const ACTION_LABELS: Record<string, string> = {
  "integration.connected": "Integration connected",
  "integration.disconnected": "Integration disconnected",
  "auto_reply.sent": "Auto-reply sent",
  "auto_reply.failed": "Auto-reply failed",
  "auto_reply.skipped": "Auto-reply skipped",
  "billing.checkout_completed": "Checkout completed",
  "billing.plan_changed": "Plan changed",
  "billing.subscription_canceled": "Subscription canceled",
  "team.member_invited": "Member invited",
  "team.member_removed": "Member removed",
};

export default async function AuditPage() {
  const entries = await listAuditLog({ limit: 200 });

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <h1 className={styles.title}>Audit log</h1>
        <p className={styles.sub}>
          Every security-relevant action in this workspace, newest first.
          Audit entries are append-only.
        </p>
      </header>

      <Card className={styles.card}>
        {entries.length === 0 ? (
          <p className={styles.empty}>No audit entries yet.</p>
        ) : (
          <ul className={styles.list}>
            {entries.map((entry) => (
              <li key={entry.id} className={styles.entry}>
                <div className={styles.entryHead}>
                  <span className={styles.action}>
                    {ACTION_LABELS[entry.action] ?? entry.action}
                  </span>
                  <span className={styles.time}>
                    {new Date(entry.createdAt).toLocaleString()}
                  </span>
                </div>
                {Object.keys(entry.metadata).length > 0 && (
                  <pre className={styles.meta}>
                    {JSON.stringify(entry.metadata, null, 2)}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
