"use client";

import { useActionState } from "react";

import { Button } from "@/shared/components/Button";

import {
  publishFormAction,
  unpublishFormAction,
  type PublishActionResult,
} from "../application/publish.actions";

import styles from "./PublishControl.module.scss";

const initial: PublishActionResult | null = null;

interface PublishControlProps {
  readonly formId: string;
  readonly status: "draft" | "published" | "archived";
  readonly currentVersion: number | null;
}

/**
 * Publish / unpublish button for the form detail page. Uses React 19
 * `useActionState` so pending + error state is handled without a
 * client-side fetch. Drafts see a single primary "Publish" button;
 * published forms see a ghost "Unpublish" button next to the version.
 */
export function PublishControl({
  formId,
  status,
  currentVersion,
}: PublishControlProps) {
  const [publishState, publishAction, publishing] = useActionState(
    publishFormAction,
    initial,
  );
  const [unpublishState, unpublishAction, unpublishing] = useActionState(
    unpublishFormAction,
    initial,
  );

  if (status === "published") {
    return (
      <div className={styles.wrap}>
        <form action={unpublishAction} className={styles.form}>
          <input type="hidden" name="id" value={formId} />
          <Button
            type="submit"
            variant="ghost"
            size="md"
            loading={unpublishing}
          >
            Unpublish
          </Button>
        </form>
        <span className={styles.versionBadge}>
          Live · v{currentVersion ?? "?"}
        </span>
        {unpublishState?.error && (
          <p className={styles.error}>{unpublishState.error}</p>
        )}
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <form action={publishAction} className={styles.form}>
        <input type="hidden" name="id" value={formId} />
        <Button
          type="submit"
          variant="primary"
          size="md"
          loading={publishing}
        >
          Publish
        </Button>
      </form>
      {publishState?.error && (
        <p className={styles.error}>{publishState.error}</p>
      )}
      {publishState?.ok && publishState.version && (
        <p className={styles.success}>
          Published v{publishState.version}.
        </p>
      )}
    </div>
  );
}
