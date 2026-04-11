"use client";

import { useActionState } from "react";
import Link from "next/link";

import { Button } from "@/shared/components/Button";
import { TextField } from "@/shared/components/TextField";

import {
  signupWithPassword,
  type ActionError,
} from "../application/actions";

import styles from "./AuthForm.module.scss";

const initialState: ActionError | null = null;

export function SignupForm() {
  const [state, action, pending] = useActionState(
    signupWithPassword,
    initialState,
  );

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <h1 className={styles.title}>Start tracking your leads</h1>
        <p className={styles.sub}>
          Ten-minute setup. No credit card. See your first attributed
          lead within a day.
        </p>
      </header>

      <form action={action} className={styles.form} noValidate>
        <TextField
          name="workspaceName"
          type="text"
          label="Workspace name"
          placeholder="Acme Co"
          autoComplete="organization"
          required
          error={state?.fieldErrors?.workspaceName}
          hint="You can rename this later. Used as the label across the app."
        />
        <TextField
          name="email"
          type="email"
          label="Work email"
          placeholder="you@company.com"
          autoComplete="email"
          required
          error={state?.fieldErrors?.email}
        />
        <TextField
          name="password"
          type="password"
          label="Password"
          placeholder="At least 10 characters"
          autoComplete="new-password"
          required
          error={state?.fieldErrors?.password}
        />
        {state?.error && !state.fieldErrors && (
          <p className={styles.error}>{state.error}</p>
        )}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          loading={pending}
        >
          Create account
        </Button>
      </form>

      <p className={styles.footer}>
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
    </div>
  );
}
