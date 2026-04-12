"use client";

import { useCallback, useEffect, useState } from "react";

import { Sidebar } from "@/shared/layout/Sidebar/Sidebar";
import { Topbar } from "@/shared/layout/Topbar/Topbar";

/**
 * Client-side shell that owns the mobile nav drawer state and wires
 * the Topbar hamburger to the Sidebar's open/close.
 *
 * The server `(app)/layout.tsx` renders this around the resolved
 * workspace context so we keep the RSC data-fetching path while still
 * sharing state between two layout pieces — no prop drilling into
 * pages, no client-side fetch.
 *
 * Behaviour:
 *   - ≥ 960px: sidebar is static (CSS grid column), drawer state is
 *     effectively a no-op.
 *   - < 960px: sidebar slides in from the left, a backdrop covers the
 *     content, Escape closes it, clicking a nav link auto-closes.
 *     Body scroll is locked while open.
 */
export interface AppShellNavProps {
  readonly workspaceName: string;
  readonly workspacePlan: string;
  readonly userEmail: string | null;
}

export function AppShellNav({
  workspaceName,
  workspacePlan,
  userEmail,
}: AppShellNavProps) {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((v) => !v), []);

  // Escape closes, body scroll lock while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <Sidebar
        workspaceName={workspaceName}
        workspacePlan={workspacePlan}
        open={open}
        onClose={close}
      />
      <Topbar
        userEmail={userEmail}
        workspaceName={workspaceName}
        onMenuClick={toggle}
        menuOpen={open}
      />
    </>
  );
}
