"use client";

import { useCallback, useMemo, useState, useTransition } from "react";

import type { FieldTypeValue, FormFieldInput } from "@/domain/form/validation";
import { OPTIONED_FIELD_TYPES } from "@/domain/form/validation";

import {
  addFieldAction,
  deleteFieldAction,
  reorderFieldsAction,
  updateFieldAction,
} from "../../application/field.actions";
import type { FormFieldDTO } from "../../application/fields.service";

import { FieldEditor } from "./FieldEditor";
import { FieldPalette } from "./FieldPalette";
import { LivePreview } from "./LivePreview";
import styles from "./FormBuilder.module.scss";

export interface FormBuilderProps {
  readonly formId: string;
  readonly formTitle: string;
  readonly submitButtonLabel: string;
  readonly initialFields: readonly FormFieldDTO[];
}

export function FormBuilder({
  formId,
  formTitle,
  submitButtonLabel,
  initialFields,
}: FormBuilderProps) {
  const [fields, setFields] = useState<readonly FormFieldDTO[]>(initialFields);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialFields[0]?.id ?? null,
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => fields.find((f) => f.id === selectedId) ?? null,
    [fields, selectedId],
  );

  // ─── Operations ───────────────────────────────────────
  const handleAdd = useCallback(
    (type: FieldTypeValue) => {
      const input = defaultInputForType(type, fields.length);
      // Optimistic insert with a temporary id so the UI updates instantly.
      const temp: FormFieldDTO = {
        id: `temp-${crypto.randomUUID()}`,
        formId,
        ...input,
        placeholder: input.placeholder ?? null,
        helpText: input.helpText ?? null,
        options: input.options ?? [],
      };
      setFields((prev) => [...prev, temp]);
      setSelectedId(temp.id);
      setError(null);

      startTransition(async () => {
        const res = await addFieldAction(formId, input);
        if (!res.ok) {
          setError(res.error);
          // Roll back the optimistic insert.
          setFields((prev) => prev.filter((f) => f.id !== temp.id));
          return;
        }
        // Replace temp with the authoritative row.
        setFields((prev) =>
          prev.map((f) => (f.id === temp.id ? res.data : f)),
        );
        setSelectedId(res.data.id);
      });
    },
    [fields.length, formId],
  );

  const handleUpdate = useCallback(
    (fieldId: string, patch: Partial<FormFieldInput>) => {
      setFields((prev) =>
        prev.map((f) => (f.id === fieldId ? mergeFieldPatch(f, patch) : f)),
      );
      // Skip server calls for temp ids (those fields haven't landed yet).
      if (fieldId.startsWith("temp-")) return;
      setError(null);
      startTransition(async () => {
        const res = await updateFieldAction(formId, fieldId, patch);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setFields((prev) =>
          prev.map((f) => (f.id === fieldId ? res.data : f)),
        );
      });
    },
    [formId],
  );

  const handleDelete = useCallback(
    (fieldId: string) => {
      const snapshot = fields;
      setFields((prev) => prev.filter((f) => f.id !== fieldId));
      if (selectedId === fieldId) setSelectedId(null);
      if (fieldId.startsWith("temp-")) return;
      setError(null);
      startTransition(async () => {
        const res = await deleteFieldAction(formId, fieldId);
        if (!res.ok) {
          setError(res.error);
          setFields(snapshot);
        }
      });
    },
    [fields, formId, selectedId],
  );

  const handleReorder = useCallback(
    (dragId: string, targetId: string) => {
      if (dragId === targetId) return;
      const next = [...fields];
      const dragIdx = next.findIndex((f) => f.id === dragId);
      const targetIdx = next.findIndex((f) => f.id === targetId);
      if (dragIdx === -1 || targetIdx === -1) return;
      const moved = next.splice(dragIdx, 1)[0];
      if (!moved) return;
      next.splice(targetIdx, 0, moved);
      setFields(next);

      // Skip server persist if any field is still a temp row.
      if (next.some((f) => f.id.startsWith("temp-"))) return;
      setError(null);
      startTransition(async () => {
        const res = await reorderFieldsAction(
          formId,
          next.map((f) => f.id),
        );
        if (!res.ok) setError(res.error);
      });
    },
    [fields, formId],
  );

  return (
    <div className={styles.builder} data-pending={pending || undefined}>
      <FieldPalette onAdd={handleAdd} />
      <LivePreview
        formTitle={formTitle}
        submitButtonLabel={submitButtonLabel}
        fields={fields}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onReorder={handleReorder}
        onDelete={handleDelete}
      />
      <FieldEditor
        field={selected}
        onChange={(patch) => selected && handleUpdate(selected.id, patch)}
        onDelete={() => selected && handleDelete(selected.id)}
      />
      {error && (
        <div role="status" className={styles.toast}>
          {error}
        </div>
      )}
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────
function defaultInputForType(
  type: FieldTypeValue,
  index: number,
): FormFieldInput {
  const base: FormFieldInput = {
    type,
    label: labelForType(type),
    required: false,
    stepIndex: 0,
    displayOrder: index,
  };
  if (OPTIONED_FIELD_TYPES.has(type)) {
    return { ...base, options: ["Option 1", "Option 2", "Option 3"] };
  }
  return base;
}

function labelForType(type: FieldTypeValue): string {
  switch (type) {
    case "short_text":
      return "Short answer";
    case "long_text":
      return "Long answer";
    case "email":
      return "Email";
    case "phone":
      return "Phone number";
    case "number":
      return "Number";
    case "dropdown":
      return "Dropdown";
    case "radio":
      return "Single choice";
    case "checkbox":
      return "Multiple choice";
    case "date":
      return "Date";
    case "file":
      return "File upload";
  }
}

function mergeFieldPatch(
  field: FormFieldDTO,
  patch: Partial<FormFieldInput>,
): FormFieldDTO {
  return {
    ...field,
    type: patch.type ?? field.type,
    label: patch.label ?? field.label,
    placeholder:
      patch.placeholder !== undefined ? (patch.placeholder ?? null) : field.placeholder,
    helpText:
      patch.helpText !== undefined ? (patch.helpText ?? null) : field.helpText,
    required: patch.required ?? field.required,
    options: patch.options ?? field.options,
    stepIndex: patch.stepIndex ?? field.stepIndex,
    displayOrder: patch.displayOrder ?? field.displayOrder,
  };
}
