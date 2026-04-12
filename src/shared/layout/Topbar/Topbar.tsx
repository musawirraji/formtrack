"use client";

import { Button } from "@/shared/components/Button";

import { logoutAction } from "@/features/auth/application/actions";

import styles from "./Topbar.module.scss";

export interface TopbarProps {
  readonly userEmail: string | null;
  readonly workspaceName: string;
  /** Called when the mobile hamburger is pressed. */
  readonly onMenuClick?: () => void;
  /** Whether the drawer is open — drives aria-expanded. */
  readonly menuOpen?: boolean;
}

export function Topbar({
  userEmail,
  workspaceName,
  onMenuClick,
  menuOpen = false,
}: TopbarProps) {
  return (
    <header className={styles.topbar}>
      <button
        type="button"
        className={styles.menuBtn}
        onClick={onMenuClick}
        aria-label="Open navigation menu"
        aria-expanded={menuOpen}
        aria-controls="primary-navigation"
      >
        <MenuIcon />
      </button>
      <div className={styles.search}>
        <SearchIcon />
        <input
          className={styles.searchInput}
          placeholder={`Search ${workspaceName}…`}
          aria-label="Search workspace"
        />
        <kbd className={styles.kbd}>⌘K</kbd>
      </div>
      <div className={styles.right}>
        <button
          type="button"
          className={styles.iconBtn}
          aria-label="Notifications"
        >
          <BellIcon />
          <span className={styles.dot} />
        </button>
        <div className={styles.divider} />
        <div className={styles.user}>
          <div className={styles.avatar}>
            {(userEmail ?? "?").slice(0, 1).toUpperCase()}
          </div>
          <div className={styles.userMeta}>
            <span className={styles.userEmail}>{userEmail ?? "Guest"}</span>
          </div>
        </div>
        <form action={logoutAction} className={styles.logoutForm}>
          <Button type="submit" variant="ghost" size="sm">
            Log out
          </Button>
        </form>
      </div>
    </header>
  );
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 6h16M4 12h16M4 18h16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="m20 20-3.5-3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M6 8a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6ZM10 19a2 2 0 0 0 4 0"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
