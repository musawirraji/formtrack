import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/shared/components/Badge";
import { Card } from "@/shared/components/Card";
import {
  getLead,
  LeadNotFoundError,
} from "@/features/leads/application/leads.service";

import styles from "./page.module.scss";

export const metadata: Metadata = { title: "Lead" };

interface Props {
  readonly params: Promise<{ id: string }>;
}

export default async function LeadDetailPage({ params }: Props) {
  const { id } = await params;

  let lead;
  try {
    lead = await getLead(id);
  } catch (err) {
    if (err instanceof LeadNotFoundError) notFound();
    throw err;
  }

  return (
    <div className={styles.wrap}>
      <nav className={styles.crumbs}>
        <Link href="/leads">Leads</Link>
        <span>/</span>
        <span>{lead.name ?? lead.email ?? "Lead"}</span>
      </nav>

      <header className={styles.header}>
        <h1 className={styles.title}>
          {lead.name ?? lead.email ?? "Untitled lead"}
        </h1>
        <div className={styles.meta}>
          <Badge
            tone={
              lead.sourceConfidence === "high"
                ? "positive"
                : lead.sourceConfidence === "medium"
                  ? "accent"
                  : "neutral"
            }
          >
            {lead.sourceLabel}
          </Badge>
          <span className={styles.metaItem}>
            {new Date(lead.createdAt).toLocaleString()}
          </span>
          {lead.country && (
            <span className={styles.metaItem}>{lead.country}</span>
          )}
        </div>
      </header>

      <div className={styles.grid}>
        <Card className={styles.card}>
          <h2 className={styles.cardTitle}>Why we attributed this</h2>
          <p className={styles.explanation}>{lead.sourceExplanation}</p>
          <dl className={styles.dl}>
            {lead.sourceCampaign && (
              <>
                <dt>Campaign</dt>
                <dd>{lead.sourceCampaign}</dd>
              </>
            )}
            {lead.sourceReferrerHost && (
              <>
                <dt>Referrer</dt>
                <dd>{lead.sourceReferrerHost}</dd>
              </>
            )}
            <dt>Confidence</dt>
            <dd>{lead.sourceConfidence}</dd>
          </dl>
        </Card>

        <Card className={styles.card}>
          <h2 className={styles.cardTitle}>Contact</h2>
          <dl className={styles.dl}>
            {lead.email && (
              <>
                <dt>Email</dt>
                <dd>
                  <a href={`mailto:${lead.email}`} className={styles.link}>
                    {lead.email}
                  </a>
                </dd>
              </>
            )}
            {lead.phone && (
              <>
                <dt>Phone</dt>
                <dd>{lead.phone}</dd>
              </>
            )}
            {lead.name && (
              <>
                <dt>Name</dt>
                <dd>{lead.name}</dd>
              </>
            )}
          </dl>
        </Card>

        <Card className={`${styles.card} ${styles.fullWidth}`}>
          <h2 className={styles.cardTitle}>Submission</h2>
          <dl className={styles.dl}>
            {Object.entries(lead.values).map(([key, value]) => (
              <div key={key} className={styles.row}>
                <dt className={styles.rowKey}>{key}</dt>
                <dd className={styles.rowValue}>
                  {Array.isArray(value)
                    ? value.join(", ")
                    : String(value ?? "")}
                </dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card className={`${styles.card} ${styles.fullWidth}`}>
          <h2 className={styles.cardTitle}>Raw attribution</h2>
          <pre className={styles.json}>
            {JSON.stringify(lead.attributionRaw, null, 2)}
          </pre>
        </Card>
      </div>
    </div>
  );
}
