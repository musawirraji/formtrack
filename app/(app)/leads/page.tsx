import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/shared/components/Badge";
import { Card } from "@/shared/components/Card";
import {
  listLeads,
  type ListLeadsFilters,
} from "@/features/leads/application/leads.service";
import type { LeadSourceConfidence } from "@/types/database";

import styles from "./page.module.scss";

export const metadata: Metadata = {
  title: "Leads",
};

interface Props {
  readonly searchParams: Promise<{
    q?: string;
    channel?: string;
  }>;
}

export default async function LeadsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const { leads, total } = await listLeads({
    search: sp.q,
    channel: sp.channel as ListLeadsFilters["channel"],
    limit: 50,
  });

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Leads</h1>
          <p className={styles.sub}>
            Every submission, with the real source — not what your
            agency claims.
          </p>
        </div>
        <div className={styles.total}>{total} total</div>
      </header>

      <form className={styles.filters}>
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Search by email or name…"
          className={styles.search}
        />
        <select
          name="channel"
          defaultValue={sp.channel ?? ""}
          className={styles.select}
        >
          <option value="">All channels</option>
          <option value="meta_ads">Meta Ads</option>
          <option value="google_ads">Google Ads</option>
          <option value="google_organic">Google (organic)</option>
          <option value="organic">Organic</option>
          <option value="email">Email</option>
          <option value="referral">Referral</option>
          <option value="direct">Direct</option>
          <option value="other">Other</option>
        </select>
        <button type="submit" className={styles.searchBtn}>
          Filter
        </button>
      </form>

      {leads.length === 0 ? (
        <Card className={styles.empty}>
          <h2 className={styles.emptyTitle}>No leads yet</h2>
          <p className={styles.emptyBody}>
            Publish a form and embed it on your site. The moment a
            visitor submits, their real source will show up here.
          </p>
          <Link href="/forms" className={styles.emptyCta}>
            Go to forms →
          </Link>
        </Card>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Contact</th>
                <th>Source</th>
                <th>Campaign</th>
                <th>Received</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id}>
                  <td>
                    <Link href={`/leads/${lead.id}`} className={styles.contact}>
                      <div className={styles.name}>
                        {lead.name ?? lead.email ?? "(no name)"}
                      </div>
                      {lead.email && (
                        <div className={styles.email}>{lead.email}</div>
                      )}
                    </Link>
                  </td>
                  <td>
                    <div className={styles.sourceCell}>
                      <Badge
                        tone={toneForConfidence(lead.sourceConfidence)}
                      >
                        {lead.sourceLabel}
                      </Badge>
                      <span className={styles.confidence}>
                        {lead.sourceConfidence}
                      </span>
                    </div>
                  </td>
                  <td className={styles.campaign}>
                    {lead.sourceCampaign ?? "—"}
                  </td>
                  <td className={styles.time}>
                    {new Date(lead.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function toneForConfidence(
  c: LeadSourceConfidence,
): "positive" | "accent" | "neutral" {
  if (c === "high") return "positive";
  if (c === "medium") return "accent";
  return "neutral";
}
