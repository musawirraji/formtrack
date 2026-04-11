import { z } from "zod";

import { formThemeSchema } from "./theme";

/**
 * Form + field validation schemas. One source of truth used by:
 *   • client-side form builder (live validation as the user types)
 *   • server actions (validation before hitting the service)
 *   • forms.service.ts (validation before hitting Postgres)
 *
 * Keeping validation in the domain folder (not the feature) is
 * intentional — these rules describe the product, not the UI.
 */

// ─── Field types ────────────────────────────────────────────
export const fieldTypeSchema = z.enum([
  "short_text",
  "long_text",
  "email",
  "phone",
  "number",
  "dropdown",
  "checkbox",
  "radio",
  "date",
  "file",
]);

export type FieldTypeValue = z.infer<typeof fieldTypeSchema>;

// Field types that require a populated `options` array.
export const OPTIONED_FIELD_TYPES = new Set<FieldTypeValue>([
  "dropdown",
  "radio",
  "checkbox",
]);

// ─── Field input ────────────────────────────────────────────
export const formFieldInputSchema = z
  .object({
    type: fieldTypeSchema,
    label: z
      .string()
      .trim()
      .min(1, "Label is required")
      .max(200, "Label is too long"),
    placeholder: z.string().max(200).optional(),
    helpText: z.string().max(500).optional(),
    required: z.boolean().default(false),
    options: z
      .array(z.string().trim().min(1).max(120))
      .max(50, "A field can't have more than 50 options")
      .optional(),
    stepIndex: z.number().int().nonnegative().default(0),
    displayOrder: z.number().int().nonnegative(),
  })
  .superRefine((field, ctx) => {
    if (OPTIONED_FIELD_TYPES.has(field.type)) {
      if (!field.options || field.options.length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["options"],
          message: `${field.type} fields need at least one option`,
        });
      }
    }
  });

export type FormFieldInput = z.infer<typeof formFieldInputSchema>;

// ─── Form create / update ──────────────────────────────────
export const formCreateSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(120, "Title is too long"),
  // Slug is optional on create — the service derives one from the
  // title if omitted. When provided, it must already match the DB
  // constraint (`^[a-z0-9][a-z0-9-]{0,60}$`).
  slug: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]{0,60}$/, "Invalid slug format")
    .optional(),
  theme: formThemeSchema.optional(),
  submitButtonLabel: z.string().trim().min(1).max(60).optional(),
  successMessage: z.string().trim().min(1).max(500).optional(),
  fields: z.array(formFieldInputSchema).max(100).optional(),
});

export type FormCreateInput = z.infer<typeof formCreateSchema>;

export const formUpdateSchema = formCreateSchema.partial().extend({
  autoReplyEnabled: z.boolean().optional(),
  autoReplyTemplate: z.string().max(5000).nullable().optional(),
  connectedInboxId: z.string().uuid().nullable().optional(),
});

export type FormUpdateInput = z.infer<typeof formUpdateSchema>;

// ─── Slugify titles ────────────────────────────────────────
// Distinct from auth.slugify (which adds randomness for uniqueness):
// form slugs must be stable and human-readable because they appear
// in the embed URL. The service appends a numeric suffix on collision.
export function titleToSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "form";
}
