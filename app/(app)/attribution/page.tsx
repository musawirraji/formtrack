import type { Metadata } from "next";

import { Card } from "@/shared/components/Card";
import { getAttributionBreakdown } from "@/features/leads/application/leads.service";

import styles from "./page.module.scss";

export const metadata: Metadata = { title: "Attribution" };

export default async function AttributionPage() {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { rows, total, confidenceTotals } = await getAttributionBreakdown({
    sinceIso: since.toISOString(),
  });

  const maxCount = rows[0]?.count ?? 0;

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <h1 className={styles.title}>Attribution</h1>
        <p className={styles.sub}>
          Last 30 days. The truth about where your leads actually
          come from, independent of any agency dashboard.
        </p>
      </header>

      <div className={styles.summary}>
        <Card className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Total leads</span>
          <span className={styles.summaryValue}>{total}</span>
        </Card>
        <Card className={styles.summaryCard}>
          <span className={styles.summaryLabel}>High confidence</span>
          <span className={styles.summaryValue}>
            {confidenceTotals.high}
          </span>
          <span className={styles.summarySub}>
            Full UTM trail captured
          </span>
        </Card>
        <Card className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Medium confidence</span>
          <span className={styles.summaryValue}>
            {confidenceTotals.medium}
          </span>
          <span className={styles.summarySub}>
            Click ID or referrer only
          </span>
        </Card>
        <Card className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Low / untracked</span>
          <span className={styles.summaryValue}>
            {confidenceTotals.low}
          </span>
          <span className={styles.summarySub}>No source signals</span>
        </Card>
      </div>

      <Card className={styles.chartCard}>
        <h2 className={styles.chartTitle}>By source channel</h2>
        {rows.length === 0 ? (
          <p className={styles.empty}>
            No leads yet in the last 30 days. Once submissions come in,
            this chart fills itself out.
          </p>
        ) : (
          <ul className={styles.barList}>
            {rows.map((row) => (
              <li key={row.channel} className={styles.bar}>
                <div className={styles.barMeta}>
                  <span className={styles.barLabel}>{row.label}</span>
                  <span className={styles.barCount}>{row.count}</span>
                </div>
                <div className={styles.barTrack}>
                  <div
                    className={styles.barFillHigh}
                    style={{
                      width: `${(row.highConfidenceCount / maxCount) * 100}%`,
                    }}
                  />
                  <div
                    className={styles.barFillMedium}
                    style={{
                      width: `${(row.mediumConfidenceCount / maxCount) * 100}%`,
                    }}
                  />
                  <div
                    className={styles.barFillLow}
                    style={{
                      width: `${(row.lowConfidenceCount / maxCount) * 100}%`,
                    }}
                  />
                </div>
                <div className={styles.barLegend}>
                  <span className={styles.legendHigh}>
                    {row.highConfidenceCount} high
                  </span>
                  <span className={styles.legendMed}>
                    {row.mediumConfidenceCount} med
                  </span>
                  <span className={styles.legendLow}>
                    {row.lowConfidenceCount} low
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
