import type { WorkspaceId } from "../workspace/Workspace";

export type FormId = string & { readonly __brand: "FormId" };
export type FieldId = string & { readonly __brand: "FieldId" };

export type FieldType =
  | "short_text"
  | "long_text"
  | "email"
  | "phone"
  | "number"
  | "dropdown"
  | "checkbox"
  | "radio"
  | "date"
  | "file";

export interface FormField {
  id: FieldId;
  type: FieldType;
  label: string;
  placeholder?: string;
  helpText?: string;
  required: boolean;
  options?: string[]; // for dropdown/radio/checkbox
  stepIndex: number;
  order: number;
}

export interface FormTheme {
  accent: string;
  font: "inter" | "inter-tight" | "serif";
  corners: "sharp" | "rounded" | "pill";
}

export type FormStatus = "draft" | "published" | "archived";

export interface Form {
  id: FormId;
  workspaceId: WorkspaceId;
  title: string;
  slug: string;
  status: FormStatus;
  fields: FormField[];
  steps: string[]; // step titles, indexed by FormField.stepIndex
  theme: FormTheme;
  submitButtonLabel: string;
  successMessage: string;
  autoReplyEnabled: boolean;
  autoReplyTemplate: string | null;
  connectedInboxId: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

/** Domain rule: a form is submittable only when published and has at least one field. */
export function isSubmittable(form: Form): boolean {
  return form.status === "published" && form.fields.length > 0;
}

/** Domain rule: collect all required field IDs across all steps. */
export function requiredFieldIds(form: Form): FieldId[] {
  return form.fields.filter((f) => f.required).map((f) => f.id);
}

export const toFormId = (s: string): FormId => s as FormId;
export const toFieldId = (s: string): FieldId => s as FieldId;
