import type { ReactNode } from "react";

import { AppShellNav } from "@/shared/layout/AppShell/AppShellNav";
import { requireWorkspaceOrRedirect } from "@/lib/auth/requireWorkspace";

import styles from "./layout.module.scss";

/**
 * Authenticated app shell. Every page under /(app)/* routes through
 * here, which means:
 *
 *   1. `requireWorkspaceOrRedirect()` guarantees the user has a session
 *      AND a workspace, or bounces them to /login or /onboarding.
 *   2. `<AppShellNav>` is a thin client wrapper that owns the mobile
 *      drawer state and renders Sidebar + Topbar. We keep the data
 *      fetch on the server and pass the bare fields in as props so
 *      there's no client-side spinner.
 *   3. Child pages receive a narrowed, safe environment: everything
 *      they query through the Supabase client is already RLS-scoped
 *      to `ctx.workspace.id`.
 *
 * Layout strategy:
 *   - ≥ 961px: two-column CSS grid (sidebar | topbar+content).
 *   - ≤ 960px: single column, sidebar becomes a fixed-position slide-
 *     in drawer triggered by the hamburger in the Topbar.
 */
export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const ctx = await requireWorkspaceOrRedirect();

  return (
    <div className={styles.grid}>
      <AppShellNav
        workspaceName={ctx.workspace.name}
        workspacePlan={ctx.workspace.plan}
        userEmail={ctx.email}
      />
      <main className={styles.content}>{children}</main>
    </div>
  );
}
