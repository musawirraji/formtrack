"use client";

import { useActionState } from "react";

import { removeMemberAction } from "@/features/team/application/actions";

import styles from "./page.module.scss";

interface Props {
  readonly userId: string;
}

export function RemoveButton({ userId }: Props) {
  const [state, action, pending] = useActionState(removeMemberAction, null);

  return (
    <form action={action}>
      <input type="hidden" name="userId" value={userId} />
      <button type="submit" disabled={pending} className={styles.removeBtn}>
        {pending ? "…" : "Remove"}
      </button>
      {state?.error && <span className={styles.errInline}>{state.error}</span>}
    </form>
  );
}
