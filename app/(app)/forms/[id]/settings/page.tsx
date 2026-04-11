import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card } from "@/shared/components/Card";
import { AutoReplySettings } from "@/features/forms/ui/AutoReplySettings";
import {
  getForm,
  FormNotFoundError,
} from "@/features/forms/application/forms.service";
import { listInboxes } from "@/features/integrations/application/integrations.service";

import styles from "./page.module.scss";

export const metadata: Metadata = { title: "Form settings" };

interface Props {
  readonly params: Promise<{ id: string }>;
}

export default async function FormSettingsPage({ params }: Props) {
  const { id } = await params;
  let form;
  try {
    form = await getForm(id);
  } catch (err) {
    if (err instanceof FormNotFoundError) notFound();
    throw err;
  }

  const inboxes = await listInboxes();

  return (
    <div className={styles.wrap}>
      <nav className={styles.crumbs}>
        <Link href="/forms">Forms</Link>
        <span>/</span>
        <Link href={`/forms/${form.id}`}>{form.title}</Link>
        <span>/</span>
        <span>Settings</span>
      </nav>

      <header className={styles.header}>
        <h1 className={styles.title}>{form.title} — settings</h1>
        <p className={styles.sub}>
          Control the auto-reply that goes out after a submission.
        </p>
      </header>

      <Card className={styles.card}>
        <h2 className={styles.cardTitle}>Auto-reply</h2>
        <AutoReplySettings
          formId={form.id}
          initial={{
            enabled: form.autoReplyEnabled,
            template: form.autoReplyTemplate,
            connectedInboxId: form.connectedInboxId,
          }}
          inboxes={inboxes}
        />
      </Card>
    </div>
  );
}
