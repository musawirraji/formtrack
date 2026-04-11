import type { ReactNode } from "react";

import { Sidebar } from "@/shared/layout/Sidebar/Sidebar";
import { Topbar } from "@/shared/layout/Topbar/Topbar";
import { requireWorkspaceOrRedirect } from "@/lib/auth/requireWorkspace";

import styles from "./layout.module.scss";

/**
 * Authenticated app shell. Every page under /(app)/* routes through
 * here, which means:
 *
 *   1. `requireWorkspaceOrRedirect()` guarantees the user has a session
 *      AND a workspace, or bounces them to /login or /onboarding.
 *   2. The Sidebar + Topbar render with the resolved workspace in one
 *      RSC pass — no client-side spinner.
 *   3. Child pages receive a narrowed, safe environment: everything
 *      they query through the Supabase client is already RLS-scoped
 *      to `ctx.workspace.id`.
 *
 * The shell uses CSS grid areas so the Sidebar + Topbar + content
 * layout works on any screen ≥ 960px. Mobile shell comes in step 3.5.
 */
export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const ctx = await requireWorkspaceOrRedirect();

  return (
    <div className={styles.grid}>
      <Sidebar
        workspaceName={ctx.workspace.name}
        workspacePlan={ctx.workspace.plan}
      />
      <Topbar
        userEmail={ctx.email}
        workspaceName={ctx.workspace.name}
      />
      <main className={styles.content}>{children}</main>
    </div>
  );
}
