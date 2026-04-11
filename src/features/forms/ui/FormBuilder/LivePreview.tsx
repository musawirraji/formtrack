"use client";

import { useState, type DragEvent } from "react";

import type { FormFieldDTO } from "../../application/fields.service";

import styles from "./LivePreview.module.scss";

export interface LivePreviewProps {
  readonly formTitle: string;
  readonly submitButtonLabel: string;
  readonly fields: readonly FormFieldDTO[];
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
  readonly onReorder: (dragId: string, targetId: string) => void;
  readonly onDelete: (id: string) => void;
}

export function LivePreview({
  formTitle,
  submitButtonLabel,
  fields,
  selectedId,
  onSelect,
  onReorder,
  onDelete,
}: LivePreviewProps) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  function handleDragStart(e: DragEvent<HTMLDivElement>, id: string) {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  }
  function handleDragOver(e: DragEvent<HTMLDivElement>, id: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (overId !== id) setOverId(id);
  }
  function handleDrop(e: DragEvent<HTMLDivElement>, id: string) {
    e.preventDefault();
    const sourceId = dragId ?? e.dataTransfer.getData("text/plain");
    if (sourceId) onReorder(sourceId, id);
    setDragId(null);
    setOverId(null);
  }
  function handleDragEnd() {
    setDragId(null);
    setOverId(null);
  }

  return (
    <section className={styles.preview} aria-label="Live form preview">
      <header className={styles.previewHeader}>
        <span className={styles.eyebrow}>Live preview</span>
        <h2 className={styles.title}>{formTitle}</h2>
      </header>

      {fields.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>No fields yet</p>
          <p className={styles.emptyBody}>
            Add a field from the palette on the left. Drag to reorder.
          </p>
        </div>
      ) : (
        <ol className={styles.list}>
          {fields.map((f, i) => {
            const isSelected = f.id === selectedId;
            const isOver = overId === f.id && dragId !== f.id;
            return (
              <li key={f.id}>
                <div
                  className={[
                    styles.row,
                    isSelected && styles.rowSelected,
                    isOver && styles.rowDropTarget,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  draggable
                  onDragStart={(e) => handleDragStart(e, f.id)}
                  onDragOver={(e) => handleDragOver(e, f.id)}
                  onDrop={(e) => handleDrop(e, f.id)}
                  onDragEnd={handleDragEnd}
                  onClick={() => onSelect(f.id)}
                  role="button"
                  tabIndex={0}
                  aria-label={`Edit field ${f.label}`}
                  aria-pressed={isSelected}
                >
                  <span className={styles.handle} aria-hidden>
                    ⋮⋮
                  </span>
                  <div className={styles.rowBody}>
                    <label className={styles.fieldLabel}>
                      {f.label}
                      {f.required && (
                        <span className={styles.required}>*</span>
                      )}
                    </label>
                    <FieldPreviewControl field={f} />
                    {f.helpText && (
                      <span className={styles.help}>{f.helpText}</span>
                    )}
                  </div>
                  <div className={styles.rowActions}>
                    <span className={styles.badge}>{i + 1}</span>
                    <button
                      type="button"
                      className={styles.deleteBtn}
                      aria-label="Delete field"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(f.id);
                      }}
                    >
                      ×
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <button type="button" className={styles.submit} disabled>
        {submitButtonLabel}
      </button>
    </section>
  );
}

function FieldPreviewControl({ field }: { field: FormFieldDTO }) {
  switch (field.type) {
    case "long_text":
      return (
        <textarea
          className={styles.input}
          placeholder={field.placeholder ?? ""}
          rows={3}
          readOnly
        />
      );
    case "dropdown":
      return (
        <select className={styles.input} disabled>
          <option>{field.placeholder ?? "Choose…"}</option>
          {field.options.map((o, i) => (
            <option key={i}>{o}</option>
          ))}
        </select>
      );
    case "radio":
      return (
        <div className={styles.optionList}>
          {field.options.map((o, i) => (
            <label key={i} className={styles.option}>
              <input type="radio" disabled /> {o}
            </label>
          ))}
        </div>
      );
    case "checkbox":
      return (
        <div className={styles.optionList}>
          {field.options.map((o, i) => (
            <label key={i} className={styles.option}>
              <input type="checkbox" disabled /> {o}
            </label>
          ))}
        </div>
      );
    case "date":
      return <input className={styles.input} type="date" readOnly />;
    case "file":
      return (
        <div className={styles.fileDrop}>Drop a file here or click to upload</div>
      );
    default:
      return (
        <input
          className={styles.input}
          type={field.type === "email" ? "email" : field.type === "phone" ? "tel" : field.type === "number" ? "number" : "text"}
          placeholder={field.placeholder ?? ""}
          readOnly
        />
      );
  }
}
