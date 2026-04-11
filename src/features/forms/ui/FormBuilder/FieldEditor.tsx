"use client";

import { useEffect, useState } from "react";

import { Button } from "@/shared/components/Button";
import { TextField } from "@/shared/components/TextField";
import { OPTIONED_FIELD_TYPES } from "@/domain/form/validation";
import type { FormFieldInput } from "@/domain/form/validation";

import type { FormFieldDTO } from "../../application/fields.service";

import styles from "./FieldEditor.module.scss";

export interface FieldEditorProps {
  readonly field: FormFieldDTO | null;
  readonly onChange: (patch: Partial<FormFieldInput>) => void;
  readonly onDelete: () => void;
}

export function FieldEditor({ field, onChange, onDelete }: FieldEditorProps) {
  // Local draft state so keystrokes don't fire a server action every letter.
  // We commit on blur for text and immediately for toggles.
  const [label, setLabel] = useState(field?.label ?? "");
  const [placeholder, setPlaceholder] = useState(field?.placeholder ?? "");
  const [helpText, setHelpText] = useState(field?.helpText ?? "");
  const [optionsText, setOptionsText] = useState(
    field ? field.options.join("\n") : "",
  );

  useEffect(() => {
    setLabel(field?.label ?? "");
    setPlaceholder(field?.placeholder ?? "");
    setHelpText(field?.helpText ?? "");
    setOptionsText(field ? field.options.join("\n") : "");
  }, [field]);

  if (!field) {
    return (
      <aside className={styles.editor} aria-label="Field editor">
        <div className={styles.placeholder}>
          <p className={styles.placeholderTitle}>Nothing selected</p>
          <p className={styles.placeholderBody}>
            Tap a field in the preview to edit its label, placeholder,
            and validation.
          </p>
        </div>
      </aside>
    );
  }

  const needsOptions = OPTIONED_FIELD_TYPES.has(field.type);

  return (
    <aside className={styles.editor} aria-label="Field editor">
      <header className={styles.header}>
        <span className={styles.eyebrow}>Editing</span>
        <h2 className={styles.title}>{field.label}</h2>
        <p className={styles.type}>{field.type.replace(/_/g, " ")}</p>
      </header>

      <div className={styles.form}>
        <TextField
          name="label"
          label="Label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => onChange({ label: label.trim() })}
          hint="What visitors see above the input."
        />
        <TextField
          name="placeholder"
          label="Placeholder"
          value={placeholder}
          onChange={(e) => setPlaceholder(e.target.value)}
          onBlur={() => onChange({ placeholder: placeholder || undefined })}
          hint="Optional hint inside the input."
        />
        <TextField
          name="helpText"
          label="Help text"
          value={helpText}
          onChange={(e) => setHelpText(e.target.value)}
          onBlur={() => onChange({ helpText: helpText || undefined })}
          hint="Shows under the input. Keep it short."
        />

        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={field.required}
            onChange={(e) => onChange({ required: e.target.checked })}
          />
          <span>
            <strong>Required</strong>
            <small>Visitors can&rsquo;t submit without filling this in.</small>
          </span>
        </label>

        {needsOptions && (
          <div className={styles.options}>
            <span className={styles.optionsLabel}>Options</span>
            <textarea
              className={styles.optionsInput}
              value={optionsText}
              placeholder={"Option 1\nOption 2\nOption 3"}
              rows={5}
              onChange={(e) => setOptionsText(e.target.value)}
              onBlur={() =>
                onChange({
                  options: optionsText
                    .split("\n")
                    .map((o) => o.trim())
                    .filter((o) => o.length > 0),
                })
              }
            />
            <span className={styles.optionsHint}>One option per line.</span>
          </div>
        )}
      </div>

      <footer className={styles.footer}>
        <Button type="button" variant="ghost" size="sm" onClick={onDelete}>
          Delete field
        </Button>
      </footer>
    </aside>
  );
}
