"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import styles from "./Sidebar.module.scss";

interface NavItem {
  readonly href: string;
  readonly label: string;
  readonly icon: ReactNode;
}

const PRIMARY: readonly NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: <DiamondIcon /> },
  { href: "/forms", label: "Forms", icon: <FormIcon /> },
  { href: "/leads", label: "Leads", icon: <InboxIcon /> },
  { href: "/attribution", label: "Attribution", icon: <CompassIcon /> },
];

const SECONDARY: readonly NavItem[] = [
  { href: "/integrations", label: "Integrations", icon: <PlugIcon /> },
  { href: "/settings", label: "Settings", icon: <GearIcon /> },
];

export interface SidebarProps {
  readonly workspaceName: string;
  readonly workspacePlan: string;
}

export function Sidebar({ workspaceName, workspacePlan }: SidebarProps) {
  const pathname = usePathname();

  return (
    <nav className={styles.sidebar} aria-label="Primary">
      <Link href="/dashboard" className={styles.logo}>
        <span className={styles.logoMark}>◆</span>
        <span className={styles.logoText}>FormTrack</span>
      </Link>

      <div className={styles.workspaceCard}>
        <div className={styles.workspaceIcon}>
          {workspaceName.slice(0, 1).toUpperCase()}
        </div>
        <div className={styles.workspaceMeta}>
          <span className={styles.workspaceName}>{workspaceName}</span>
          <span className={styles.workspacePlan}>{workspacePlan} plan</span>
        </div>
      </div>

      <ul className={styles.group}>
        {PRIMARY.map((item) => (
          <li key={item.href}>
            <NavLink item={item} pathname={pathname} />
          </li>
        ))}
      </ul>

      <div className={styles.spacer} />

      <ul className={styles.group}>
        {SECONDARY.map((item) => (
          <li key={item.href}>
            <NavLink item={item} pathname={pathname} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

function NavLink({
  item,
  pathname,
}: {
  item: NavItem;
  pathname: string;
}) {
  const active =
    pathname === item.href || pathname.startsWith(`${item.href}/`);
  return (
    <Link
      href={item.href}
      className={[styles.link, active && styles.linkActive]
        .filter(Boolean)
        .join(" ")}
      aria-current={active ? "page" : undefined}
    >
      <span className={styles.linkIcon}>{item.icon}</span>
      <span className={styles.linkLabel}>{item.label}</span>
    </Link>
  );
}

// ─── Inline icons (kept lightweight; no extra bundle weight) ──
function DiamondIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3 3 12l9 9 9-9-9-9Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function FormIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect
        x="4"
        y="3"
        width="16"
        height="18"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M8 9h8M8 13h8M8 17h5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
function InboxIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 13v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5M4 13l2-8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2l2 8M4 13h4l2 3h4l2-3h4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function CompassIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="m15.5 8.5-2 5-5 2 2-5 5-2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function PlugIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M9 7V3M15 7V3M7 7h10v4a5 5 0 0 1-5 5h0a5 5 0 0 1-5-5V7ZM12 16v5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}
