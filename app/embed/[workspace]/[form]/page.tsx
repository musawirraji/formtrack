import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  FormNotPublishedError,
  getPublishedSnapshot,
} from "@/features/forms/application/publish.service";

import { EmbedRuntime } from "./EmbedRuntime";

/**
 * Hosted form page for customers who want an iframe-able URL instead
 * of dropping the script onto their site. The page is a thin server
 * shell that hydrates the same snapshot the embed script consumes —
 * the `<EmbedRuntime>` client component handles attribution capture
 * and submission over fetch.
 *
 * This route is public and unauthenticated. It's intentionally
 * excluded from the auth middleware matcher so there are zero
 * cookies on the request, which makes it CDN-cacheable.
 */

export const dynamic = "force-dynamic";

interface Props {
  readonly params: Promise<{ workspace: string; form: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { workspace, form } = await params;
  try {
    const snapshot = await getPublishedSnapshot(workspace, form);
    return {
      title: snapshot.title,
      robots: { index: false },
    };
  } catch {
    return { title: "Form" };
  }
}

export default async function EmbedPage({ params }: Props) {
  const { workspace, form } = await params;

  let snapshot;
  try {
    snapshot = await getPublishedSnapshot(workspace, form);
  } catch (err) {
    if (err instanceof FormNotPublishedError) notFound();
    throw err;
  }

  return (
    <main
      style={{
        padding: "32px 20px",
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#1a1a1f",
        background: "#fff",
        minHeight: "100vh",
      }}
    >
      <EmbedRuntime snapshot={snapshot} />
    </main>
  );
}
