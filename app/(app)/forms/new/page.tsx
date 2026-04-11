import type { Metadata } from "next";
import Link from "next/link";

import { NewFormForm } from "@/features/forms/ui/NewFormForm";
import { TemplateGallery } from "@/features/forms/ui/TemplateGallery";

import styles from "./page.module.scss";

export const metadata: Metadata = {
  title: "New form",
};

export default function NewFormPage() {
  return (
    <div className={styles.wrap}>
      <nav className={styles.crumbs}>
        <Link href="/forms">Forms</Link>
        <span>/</span>
        <span>New form</span>
      </nav>
      <header className={styles.header}>
        <h1 className={styles.title}>Start a new form</h1>
        <p className={styles.sub}>
          Pick a template to get moving fast, or start blank and build
          it field by field. Either way, you can change everything
          later.
        </p>
      </header>

      <section className={styles.section}>
        <TemplateGallery />
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Or name it yourself</h2>
          <p className={styles.sectionSub}>
            Create a blank form with a custom title and slug.
          </p>
        </div>
        <NewFormForm />
      </section>
    </div>
  );
}
