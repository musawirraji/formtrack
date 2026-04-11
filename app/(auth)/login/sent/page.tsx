import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Check your email",
};

export default function MagicLinkSentPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 32,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          color: "var(--color-ink)",
          margin: 0,
        }}
      >
        Check your email
      </h1>
      <p style={{ color: "var(--color-ink-2)", lineHeight: 1.5, margin: 0 }}>
        We sent you a magic link. Click it and you&rsquo;ll be signed in —
        no password required.
      </p>
      <p style={{ fontSize: 14, color: "var(--color-ink-3)", margin: 0 }}>
        Wrong email?{" "}
        <Link href="/login" style={{ color: "var(--color-accent)" }}>
          Try again
        </Link>
        .
      </p>
    </div>
  );
}
