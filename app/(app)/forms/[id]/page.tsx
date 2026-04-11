import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/shared/components/Badge";
import { Button } from "@/shared/components/Button";
import {
  FormNotFoundError,
  getForm,
} from "@/features/forms/application/forms.service";
import { listFields } from "@/features/forms/application/fields.service";
import { listVersions } from "@/features/forms/application/publish.service";
import { deleteFormAction } from "@/features/forms/application/actions";
import { FormBuilder } from "@/features/forms/ui/FormBuilder/FormBuilder";
import { PublishControl } from "@/features/forms/ui/PublishControl";

import styles from "./page.module.scss";

export const metadata: Metadata = {
  title: "Form",
};

interface Props {
  readonly params: Promise<{ id: string }>;
}

export default async function FormDetailPage({ params }: Props) {
  const { id } = await params;

  let form;
  let fields;
  let versions;
  try {
    form = await getForm(id);
    [fields, versions] = await Promise.all([listFields(id), listVersions(id)]);
  } catch (err) {
    if (err instanceof FormNotFoundError) notFound();
    throw err;
  }

  const currentVersion = versions[0]?.version ?? null;

  return (
    <div className={styles.wrap}>
      <nav className={styles.crumbs}>
        <Link href="/forms">Forms</Link>
        <span>/</span>
        <span>{form.title}</span>
      </nav>

      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{form.title}</h1>
          <div className={styles.meta}>
            <Badge
              tone={
                form.status === "published"
                  ? "positive"
                  : form.status === "draft"
                    ? "accent"
                    : "neutral"
              }
            >
              {form.status}
            </Badge>
            <code className={styles.slug}>/{form.slug}</code>
            <span className={styles.metaCount}>
              {fields.length} field{fields.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        <div className={styles.actions}>
          <PublishControl
            formId={form.id}
            status={form.status}
            currentVersion={currentVersion}
          />
          <form action={deleteFormAction}>
            <input type="hidden" name="id" value={form.id} />
            <Button type="submit" variant="ghost" size="md">
              Delete
            </Button>
          </form>
        </div>
      </header>

      <FormBuilder
        formId={form.id}
        formTitle={form.title}
        submitButtonLabel={form.submitButtonLabel}
        initialFields={fields}
      />
    </div>
  );
}
