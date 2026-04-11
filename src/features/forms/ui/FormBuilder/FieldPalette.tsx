"use client";

import type { FieldTypeValue } from "@/domain/form/validation";

import styles from "./FieldPalette.module.scss";

interface PaletteItem {
  readonly type: FieldTypeValue;
  readonly label: string;
  readonly hint: string;
  readonly icon: string;
}

const PALETTE: readonly PaletteItem[] = [
  { type: "short_text", label: "Short answer", hint: "Name, company, title", icon: "Aa" },
  { type: "long_text", label: "Long answer", hint: "Message, notes", icon: "¶" },
  { type: "email", label: "Email", hint: "you@company.com", icon: "@" },
  { type: "phone", label: "Phone", hint: "With format hint", icon: "☎" },
  { type: "number", label: "Number", hint: "Budget, count", icon: "#" },
  { type: "dropdown", label: "Dropdown", hint: "Single pick, many options", icon: "▾" },
  { type: "radio", label: "Single choice", hint: "Radio buttons", icon: "◉" },
  { type: "checkbox", label: "Multi choice", hint: "Multiple selections", icon: "☑" },
  { type: "date", label: "Date", hint: "Calendar picker", icon: "📅" },
  { type: "file", label: "File", hint: "Upload attachment", icon: "📎" },
];

export interface FieldPaletteProps {
  readonly onAdd: (type: FieldTypeValue) => void;
}

export function FieldPalette({ onAdd }: FieldPaletteProps) {
  return (
    <aside className={styles.palette} aria-label="Field palette">
      <header className={styles.header}>
        <h2 className={styles.title}>Fields</h2>
        <p className={styles.sub}>Tap to add to your form.</p>
      </header>
      <ul className={styles.list}>
        {PALETTE.map((item) => (
          <li key={item.type}>
            <button
              type="button"
              className={styles.item}
              onClick={() => onAdd(item.type)}
            >
              <span className={styles.icon}>{item.icon}</span>
              <span className={styles.text}>
                <span className={styles.label}>{item.label}</span>
                <span className={styles.hint}>{item.hint}</span>
              </span>
              <span className={styles.plus}>+</span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
