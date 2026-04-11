import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Verify your email",
};

export default function VerifyEmailPage() {
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
        Almost there
      </h1>
      <p style={{ color: "var(--color-ink-2)", lineHeight: 1.5, margin: 0 }}>
        We sent a confirmation link to your email. Click it and we&rsquo;ll
        drop you straight into your new workspace.
      </p>
      <p style={{ fontSize: 14, color: "var(--color-ink-3)", margin: 0 }}>
        Already verified?{" "}
        <Link href="/login" style={{ color: "var(--color-accent)" }}>
          Sign in
        </Link>
        .
      </p>
    </div>
  );
}
