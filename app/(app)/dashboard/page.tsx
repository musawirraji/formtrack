import type { Metadata } from "next";

import { Badge } from "@/shared/components/Badge";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { requireWorkspaceOrRedirect } from "@/lib/auth/requireWorkspace";

import styles from "./page.module.scss";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const ctx = await requireWorkspaceOrRedirect();

  // Step 3 ships the shell + hero. Real numbers land in step 9 when
  // the lead inbox + attribution query hit the leads table.
  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>
            Welcome back, {ctx.email?.split("@")[0] ?? "friend"}
          </p>
          <h1 className={styles.title}>
            Here&rsquo;s what&rsquo;s happening inside{" "}
            <em>{ctx.workspace.name}</em>
          </h1>
        </div>
        <div className={styles.headerActions}>
          <Button variant="outline" size="md">
            Copy embed snippet
          </Button>
          <Button variant="primary" size="md">
            + New form
          </Button>
        </div>
      </header>

      <Card glow className={styles.hero}>
        <div className={styles.heroTop}>
          <Badge tone="accent">Leads this month</Badge>
          <span className={styles.heroRange}>April 1 – April 11</span>
        </div>
        <div className={styles.heroNumber}>
          <span>0</span>
          <span className={styles.heroDelta}>
            Ship your first form to start tracking
          </span>
        </div>
        <div className={styles.heroFooter}>
          <span className={styles.heroFooterLabel}>Top source</span>
          <span className={styles.heroFooterValue}>— no leads yet —</span>
        </div>
      </Card>

      <div className={styles.grid}>
        <Card>
          <h2 className={styles.cardTitle}>Top sources</h2>
          <p className={styles.cardEmpty}>
            You&rsquo;ll see your channel breakdown here the moment a
            lead comes through.
          </p>
        </Card>
        <Card>
          <h2 className={styles.cardTitle}>Attribution confidence</h2>
          <p className={styles.cardEmpty}>
            We&rsquo;ll explain, in plain English, why every lead is
            attributed the way it is.
          </p>
        </Card>
        <Card>
          <h2 className={styles.cardTitle}>Recent leads</h2>
          <p className={styles.cardEmpty}>
            No leads yet — your embed script will drop them in here in
            real time.
          </p>
        </Card>
      </div>
    </div>
  );
}
