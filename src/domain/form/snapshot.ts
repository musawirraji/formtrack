import type { FormThemeInput } from "./theme";
import type { FieldTypeValue } from "./validation";

/**
 * A FormSnapshot is the immutable, self-contained rendering of a
 * form at publish time. The embed script consumes it over the wire,
 * so every field it needs to render the form, validate submissions,
 * and attribute leads must be present.
 *
 * Pure data — no references to Supabase row types — so it can be
 * serialized, cached, and diffed without pulling the infrastructure
 * layer into the domain.
 */

export const SNAPSHOT_VERSION = 1 as const;

export interface FormSnapshotField {
  readonly id: string;
  readonly type: FieldTypeValue;
  readonly label: string;
  readonly placeholder: string | null;
  readonly helpText: string | null;
  readonly required: boolean;
  readonly options: readonly string[];
  readonly stepIndex: number;
  readonly displayOrder: number;
}

export interface FormSnapshot {
  readonly schemaVersion: typeof SNAPSHOT_VERSION;
  readonly formId: string;
  readonly workspaceId: string;
  readonly slug: string;
  readonly title: string;
  readonly theme: FormThemeInput;
  readonly submitButtonLabel: string;
  readonly successMessage: string;
  readonly fields: readonly FormSnapshotField[];
  /** Monotonic version number. Incremented on every publish. */
  readonly version: number;
  readonly publishedAt: string;
}

export interface SnapshotInput {
  readonly formId: string;
  readonly workspaceId: string;
  readonly slug: string;
  readonly title: string;
  readonly theme: FormThemeInput;
  readonly submitButtonLabel: string;
  readonly successMessage: string;
  readonly fields: readonly FormSnapshotField[];
  readonly version: number;
  readonly publishedAt: string;
}

export function buildSnapshot(input: SnapshotInput): FormSnapshot {
  return {
    schemaVersion: SNAPSHOT_VERSION,
    formId: input.formId,
    workspaceId: input.workspaceId,
    slug: input.slug,
    title: input.title,
    theme: input.theme,
    submitButtonLabel: input.submitButtonLabel,
    successMessage: input.successMessage,
    // Fields are sorted deterministically so snapshots diff cleanly.
    fields: [...input.fields].sort((a, b) => {
      if (a.stepIndex !== b.stepIndex) return a.stepIndex - b.stepIndex;
      return a.displayOrder - b.displayOrder;
    }),
    version: input.version,
    publishedAt: input.publishedAt,
  };
}
