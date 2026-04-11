"use client";

import { useActionState } from "react";
import Link from "next/link";

import { Button } from "@/shared/components/Button";
import { TextField } from "@/shared/components/TextField";

import {
  loginWithPassword,
  sendMagicLink,
  type ActionError,
} from "../application/actions";

import styles from "./AuthForm.module.scss";

const initialState: ActionError | null = null;

export function LoginForm() {
  const [loginState, loginAction, loginPending] = useActionState(
    loginWithPassword,
    initialState,
  );
  const [magicState, magicAction, magicPending] = useActionState(
    sendMagicLink,
    initialState,
  );

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <h1 className={styles.title}>Welcome back</h1>
        <p className={styles.sub}>
          Sign in to see where your leads actually came from.
        </p>
      </header>

      <form action={loginAction} className={styles.form} noValidate>
        <TextField
          name="email"
          type="email"
          label="Work email"
          placeholder="you@company.com"
          autoComplete="email"
          required
          error={loginState?.fieldErrors?.email}
        />
        <TextField
          name="password"
          type="password"
          label="Password"
          placeholder="••••••••••"
          autoComplete="current-password"
          required
          error={loginState?.fieldErrors?.password}
        />
        {loginState?.error && !loginState.fieldErrors && (
          <p className={styles.error}>{loginState.error}</p>
        )}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          loading={loginPending}
        >
          Sign in
        </Button>
      </form>

      <div className={styles.divider}>
        <span>or</span>
      </div>

      <form action={magicAction} className={styles.form} noValidate>
        <TextField
          name="email"
          type="email"
          label="Email me a magic link"
          placeholder="you@company.com"
          autoComplete="email"
          required
          error={magicState?.fieldErrors?.email}
        />
        {magicState?.error && !magicState.fieldErrors && (
          <p className={styles.error}>{magicState.error}</p>
        )}
        <Button
          type="submit"
          variant="outline"
          size="lg"
          fullWidth
          loading={magicPending}
        >
          Send magic link
        </Button>
      </form>

      <p className={styles.footer}>
        No account yet? <Link href="/signup">Create one</Link>
      </p>
    </div>
  );
}
