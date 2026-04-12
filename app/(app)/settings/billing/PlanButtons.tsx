"use client";

import { useState, useTransition } from "react";

import type { PlanId } from "@/features/billing/application/plans";

import styles from "./page.module.scss";

interface Props {
  readonly planId: PlanId;
  readonly isCurrent: boolean;
  readonly isFree: boolean;
}

export function PlanButtons({ planId, isCurrent, isFree }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const upgrade = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/billing/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan: planId }),
        });
        const json = (await res.json()) as { url?: string; error?: string };
        if (json.url) {
          window.location.href = json.url;
        } else {
          setError(json.error ?? "Checkout failed");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Checkout failed");
      }
    });
  };

  const openPortal = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/billing/portal", { method: "POST" });
        const json = (await res.json()) as { url?: string; error?: string };
        if (json.url) {
          window.location.href = json.url;
        } else {
          setError(json.error ?? "Unable to open billing portal");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Portal failed");
      }
    });
  };

  if (isCurrent && !isFree) {
    return (
      <div className={styles.buttonRow}>
        <button
          type="button"
          onClick={openPortal}
          disabled={pending}
          className={styles.secondaryBtn}
        >
          {pending ? "Opening…" : "Manage subscription"}
        </button>
        {error && <p className={styles.err}>{error}</p>}
      </div>
    );
  }

  if (isCurrent && isFree) {
    return <p className={styles.currentNote}>You&apos;re on the free plan.</p>;
  }

  if (isFree) {
    return <p className={styles.currentNote}>Downgrade via Manage subscription.</p>;
  }

  return (
    <div className={styles.buttonRow}>
      <button
        type="button"
        onClick={upgrade}
        disabled={pending}
        className={styles.primaryBtn}
      >
        {pending ? "Redirecting…" : `Upgrade to ${planId}`}
      </button>
      {error && <p className={styles.err}>{error}</p>}
    </div>
  );
}
