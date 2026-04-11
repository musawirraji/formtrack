"use client";

import { useActionState } from "react";

import { disconnectIntegrationAction } from "@/features/integrations/application/actions";

import styles from "./page.module.scss";

interface Props {
  readonly id: string;
}

export function DisconnectButton({ id }: Props) {
  const [state, action, pending] = useActionState(
    disconnectIntegrationAction,
    null,
  );

  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending} className={styles.disconnectBtn}>
        {pending ? "Disconnecting…" : "Disconnect"}
      </button>
      {state?.error && <p className={styles.err}>{state.error}</p>}
    </form>
  );
}
