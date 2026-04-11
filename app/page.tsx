import Link from "next/link";
import styles from "./page.module.scss";

export default function LandingPage() {
  return (
    <main className={styles.root}>
      <div className={styles.nav}>
        <div className={styles.brand}>
          <span className={styles.mark} aria-hidden />
          FormTrack
        </div>
        <div className={styles.navRight}>
          <Link href="/login" className={styles.link}>
            Log in
          </Link>
          <Link href="/signup" className={styles.cta}>
            Start free
          </Link>
        </div>
      </div>

      <section className={styles.hero}>
        <span className={styles.eyebrow}>Lead attribution that tells the truth</span>
        <h1 className={styles.title}>
          Know exactly <em>where your leads come from</em>.
        </h1>
        <p className={styles.sub}>
          Build lead capture forms, embed them on your site, and every lead arrives with a
          plain-English explanation of the campaign, ad platform, or page that drove it.
          Verify what your marketing agency is telling you — in real time.
        </p>

        <div className={styles.ctas}>
          <Link href="/signup" className={styles.primaryBtn}>
            Create your first form →
          </Link>
          <Link href="/dashboard" className={styles.ghostBtn}>
            See the dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
