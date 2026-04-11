"use client";

import { useActionState, useState } from "react";

import { FORM_TEMPLATES, type TemplateKey } from "@/domain/form/templates";

import {
  createFormFromTemplateAction,
  type FormActionError,
} from "../application/actions";

import styles from "./TemplateGallery.module.scss";

const initialState: FormActionError | null = null;

/**
 * Gallery of starter templates. Clicking a card submits a server
 * action that creates the form seeded with the template's fields
 * and redirects to the detail page — the builder picks up from there.
 *
 * The "Start from scratch" card submits with an empty templateKey so
 * the same action creates a blank form without branching in the UI.
 */
export function TemplateGallery() {
  const [state, action, pending] = useActionState(
    createFormFromTemplateAction,
    initialState,
  );
  const [submittingKey, setSubmittingKey] = useState<string | null>(null);

  return (
    <div className={styles.wrap}>
      <form action={action} className={styles.gallery}>
        <button
          type="submit"
          name="templateKey"
          value=""
          className={`${styles.card} ${styles.cardBlank}`}
          disabled={pending}
          onClick={() => setSubmittingKey("")}
        >
          <span className={styles.cardBadge}>Blank</span>
          <h3 className={styles.cardTitle}>Start from scratch</h3>
          <p className={styles.cardBlurb}>
            Build your own form field by field. We&rsquo;ll drop you
            straight into the builder.
          </p>
          <span className={styles.cardCta}>
            {pending && submittingKey === "" ? "Creating…" : "Blank form →"}
          </span>
        </button>

        {FORM_TEMPLATES.map((template) => (
          <TemplateCard
            key={template.key}
            templateKey={template.key}
            title={template.title}
            blurb={template.blurb}
            badge={template.badge}
            fieldCount={template.fields.length}
            pending={pending && submittingKey === template.key}
            disabled={pending}
            onClick={() => setSubmittingKey(template.key)}
          />
        ))}
      </form>

      {state?.error && (
        <p role="alert" className={styles.error}>
          {state.error}
        </p>
      )}
    </div>
  );
}

interface TemplateCardProps {
  readonly templateKey: TemplateKey;
  readonly title: string;
  readonly blurb: string;
  readonly badge: string;
  readonly fieldCount: number;
  readonly pending: boolean;
  readonly disabled: boolean;
  readonly onClick: () => void;
}

function TemplateCard({
  templateKey,
  title,
  blurb,
  badge,
  fieldCount,
  pending,
  disabled,
  onClick,
}: TemplateCardProps) {
  return (
    <button
      type="submit"
      name="templateKey"
      value={templateKey}
      className={styles.card}
      disabled={disabled}
      onClick={onClick}
    >
      <span className={styles.cardBadge}>{badge}</span>
      <h3 className={styles.cardTitle}>{title}</h3>
      <p className={styles.cardBlurb}>{blurb}</p>
      <div className={styles.cardFooter}>
        <span className={styles.cardMeta}>
          {fieldCount} field{fieldCount === 1 ? "" : "s"}
        </span>
        <span className={styles.cardCta}>
          {pending ? "Creating…" : "Use template →"}
        </span>
      </div>
    </button>
  );
}
