"use client";

import { useActionState } from "react";

import { updateAutoReplyAction } from "../application/autoReply.actions";
import type { IntegrationSummary } from "@/features/integrations/application/integrations.service";

import styles from "./AutoReplySettings.module.scss";

interface Props {
  readonly formId: string;
  readonly initial: {
    readonly enabled: boolean;
    readonly template: string | null;
    readonly connectedInboxId: string | null;
  };
  readonly inboxes: IntegrationSummary[];
}

const DEFAULT_TEMPLATE = `Hi {{name}},

Thanks for reaching out via the {{form}} form. I wanted to let you know
I got your message — I'll be in touch personally in the next 24 hours.

Talk soon,`;

export function AutoReplySettings({ formId, initial, inboxes }: Props) {
  const [state, action, pending] = useActionState(updateAutoReplyAction, null);

  const hasInbox = inboxes.length > 0;

  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="formId" value={formId} />

      <div className={styles.row}>
        <label className={styles.toggleLabel}>
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={initial.enabled}
            disabled={!hasInbox}
          />
          <span>Send an auto-reply when someone submits this form</span>
        </label>
        {!hasInbox && (
          <p className={styles.warning}>
            Connect an inbox under{" "}
            <a href="/integrations">Integrations</a> to enable this.
          </p>
        )}
      </div>

      {hasInbox && (
        <>
          <div className={styles.row}>
            <label htmlFor="connectedInboxId" className={styles.label}>
              From inbox
            </label>
            <select
              id="connectedInboxId"
              name="connectedInboxId"
              defaultValue={initial.connectedInboxId ?? ""}
              className={styles.select}
            >
              <option value="">— select an inbox —</option>
              {inboxes.map((inbox) => (
                <option key={inbox.id} value={inbox.id}>
                  {inbox.providerLabel}: {inbox.accountEmail ?? inbox.id}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.row}>
            <label htmlFor="template" className={styles.label}>
              Message
            </label>
            <textarea
              id="template"
              name="template"
              rows={10}
              defaultValue={initial.template ?? DEFAULT_TEMPLATE}
              className={styles.textarea}
            />
            <p className={styles.hint}>
              Variables: <code>{"{{name}}"}</code>, <code>{"{{email}}"}</code>,{" "}
              <code>{"{{form}}"}</code>
            </p>
          </div>
        </>
      )}

      <div className={styles.actions}>
        <button type="submit" disabled={pending} className={styles.save}>
          {pending ? "Saving…" : "Save auto-reply"}
        </button>
        {state?.ok && <span className={styles.ok}>Saved.</span>}
        {state?.error && <span className={styles.err}>{state.error}</span>}
      </div>
    </form>
  );
}
