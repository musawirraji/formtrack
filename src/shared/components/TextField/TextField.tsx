"use client";

import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";

import styles from "./TextField.module.scss";

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  function TextField(
    { label, hint, error, leading, trailing, id, className, ...rest },
    ref,
  ) {
    const inputId = id ?? rest.name ?? undefined;
    const describedById = error
      ? `${inputId}-error`
      : hint
        ? `${inputId}-hint`
        : undefined;

    return (
      <label className={[styles.field, className].filter(Boolean).join(" ")}>
        <span className={styles.label}>{label}</span>
        <span
          className={[
            styles.control,
            error && styles.errored,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {leading && <span className={styles.leading}>{leading}</span>}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedById}
            className={styles.input}
            {...rest}
          />
          {trailing && <span className={styles.trailing}>{trailing}</span>}
        </span>
        {error ? (
          <span id={`${inputId}-error`} className={styles.error}>
            {error}
          </span>
        ) : hint ? (
          <span id={`${inputId}-hint`} className={styles.hint}>
            {hint}
          </span>
        ) : null}
      </label>
    );
  },
);
