"use client";

import { useActionState } from "react";

import { inviteMemberAction } from "@/features/team/application/actions";

import styles from "./page.module.scss";

export function InviteForm() {
  const [state, action, pending] = useActionState(inviteMemberAction, null);

  return (
    <form action={action} className={styles.inviteForm}>
      <div className={styles.inviteRow}>
        <input
          type="email"
          name="email"
          placeholder="teammate@company.com"
          required
          className={styles.input}
        />
        <select
          name="role"
          defaultValue="member"
          className={styles.select}
        >
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
        <button type="submit" disabled={pending} className={styles.submit}>
          {pending ? "Inviting…" : "Send invite"}
        </button>
      </div>
      {state?.ok && <p className={styles.ok}>Invite sent.</p>}
      {state?.error && (
        <p className={styles.err}>
          {state.error}
          {state.upgradeRequired && (
            <>
              {" "}
              <a href="/settings/billing">Upgrade</a>
            </>
          )}
        </p>
      )}
    </form>
  );
}
