"use client";

import { useActionState } from "react";

import { Button } from "@/shared/components/Button";
import { TextField } from "@/shared/components/TextField";

import {
  createFormAction,
  type FormActionError,
} from "../application/actions";

import styles from "./NewFormForm.module.scss";

const initialState: FormActionError | null = null;

export function NewFormForm() {
  const [state, action, pending] = useActionState(
    createFormAction,
    initialState,
  );

  return (
    <form action={action} className={styles.form} noValidate>
      <TextField
        name="title"
        type="text"
        label="Form title"
        placeholder="Get a quote"
        required
        autoFocus
        error={state?.fieldErrors?.title}
        hint="Shows up in your dashboard, not to visitors."
      />
      <TextField
        name="slug"
        type="text"
        label="URL slug"
        placeholder="get-a-quote (we'll generate one if you skip this)"
        error={state?.fieldErrors?.slug}
        hint="Lowercase letters, numbers, and dashes. Appears in the embed URL."
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
        Create form
      </Button>
    </form>
  );
}
