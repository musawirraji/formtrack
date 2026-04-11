import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/shared/components/Badge";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { listForms } from "@/features/forms/application/forms.service";
import { relativeTime } from "@/lib/utils";

import styles from "./page.module.scss";

export const metadata: Metadata = {
  title: "Forms",
};

// The (app) layout already runs requireWorkspaceOrRedirect, so by the
// time this page executes we know we have a real authenticated ctx.
// listForms() itself calls requireWorkspace() again — that's the
// defense-in-depth pattern: services don't trust their callers.
export default async function FormsPage() {
  const forms = await listForms();

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Forms</p>
          <h1 className={styles.title}>
            Every form you&rsquo;ve ever shipped
          </h1>
        </div>
        <Link href="/forms/new" className={styles.cta}>
          <Button variant="primary" size="md">
            + New form
          </Button>
        </Link>
      </header>

      {forms.length === 0 ? (
        <Card className={styles.empty}>
          <h2 className={styles.emptyTitle}>
            Your first form is a couple of clicks away
          </h2>
          <p className={styles.emptyBody}>
            Create a form, drop its embed snippet on your site, and watch
            leads stream in with their real source — not what the agency
            told you.
          </p>
          <Link href="/forms/new">
            <Button variant="primary" size="md">
              Create your first form
            </Button>
          </Link>
        </Card>
      ) : (
        <ul className={styles.grid}>
          {forms.map((f) => (
            <li key={f.id}>
              <Link href={`/forms/${f.id}`} className={styles.cardLink}>
                <Card className={styles.card}>
                  <div className={styles.cardHead}>
                    <h3 className={styles.cardTitle}>{f.title}</h3>
                    <Badge tone={toneForStatus(f.status)}>{f.status}</Badge>
                  </div>
                  <div className={styles.cardMeta}>
                    <span>
                      {f.fieldCount} {f.fieldCount === 1 ? "field" : "fields"}
                    </span>
                    <span>·</span>
                    <span>Updated {relativeTime(f.updatedAt, new Date())}</span>
                  </div>
                  <code className={styles.slug}>/{f.slug}</code>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function toneForStatus(
  status: "draft" | "published" | "archived",
): "neutral" | "accent" | "positive" {
  switch (status) {
    case "published":
      return "positive";
    case "draft":
      return "accent";
    case "archived":
      return "neutral";
  }
}
