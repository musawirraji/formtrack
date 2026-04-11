import Link from "next/link";
import type { ReactNode } from "react";

import styles from "./layout.module.scss";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <aside className={styles.brand} aria-hidden>
        <div className={styles.brandInner}>
          <Link href="/" className={styles.logo}>
            <span className={styles.logoMark}>◆</span>
            <span>FormTrack</span>
          </Link>
          <div className={styles.quote}>
            <p className={styles.quoteText}>
              “We thought 60% of our leads came from Instagram. Turns
              out it was 12%. Our ad budget looks very different this
              quarter.”
            </p>
            <p className={styles.quoteAuthor}>
              — Sara K., founder, 3-location med spa
            </p>
          </div>
        </div>
        <div className={styles.glow} />
      </aside>
      <main className={styles.panel}>
        <div className={styles.panelInner}>{children}</div>
      </main>
    </div>
  );
}
