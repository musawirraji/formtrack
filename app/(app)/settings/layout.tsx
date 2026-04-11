import Link from "next/link";
import type { ReactNode } from "react";

import styles from "./layout.module.scss";

interface Props {
  readonly children: ReactNode;
}

const TABS = [
  { href: "/settings/billing", label: "Billing" },
  { href: "/settings/team", label: "Team" },
  { href: "/settings/audit", label: "Audit log" },
];

export default function SettingsLayout({ children }: Props) {
  return (
    <div className={styles.shell}>
      <aside className={styles.nav}>
        <h2 className={styles.navTitle}>Settings</h2>
        <ul className={styles.navList}>
          {TABS.map((tab) => (
            <li key={tab.href}>
              <Link href={tab.href} className={styles.navLink}>
                {tab.label}
              </Link>
            </li>
          ))}
        </ul>
      </aside>
      <main className={styles.content}>{children}</main>
    </div>
  );
}
