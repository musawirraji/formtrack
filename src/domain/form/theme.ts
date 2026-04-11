import { z } from "zod";

/**
 * FormTheme — the configurable presentation layer for every embedded
 * form. Themes are stored in `forms.theme jsonb` and validated by the
 * schema below on both read and write so we never trust what's
 * sitting in the column.
 *
 * Deliberately narrow: hex accent, three font families, three corner
 * radii. If we expand this later (e.g. custom CSS), the schema is the
 * one place to widen.
 */

const HEX = /^#[0-9a-fA-F]{6}$/;

export const formFontSchema = z.enum(["inter", "inter-tight", "serif"]);
export const formCornersSchema = z.enum(["sharp", "rounded", "pill"]);

export const formThemeSchema = z.object({
  accent: z
    .string()
    .regex(HEX, "Accent must be a 6-digit hex color (e.g. #7C6BFF)"),
  font: formFontSchema,
  corners: formCornersSchema,
});

export type FormThemeInput = z.infer<typeof formThemeSchema>;

export const DEFAULT_THEME: FormThemeInput = Object.freeze({
  accent: "#7C6BFF",
  font: "inter-tight",
  corners: "rounded",
});

/**
 * Safely coerce whatever JSON we pulled from Postgres into a valid
 * theme. On any parse failure we fall back to DEFAULT_THEME rather
 * than crashing the dashboard — a malformed theme is a soft failure,
 * not a hard one.
 */
export function parseTheme(raw: unknown): FormThemeInput {
  const result = formThemeSchema.safeParse(raw);
  return result.success ? result.data : DEFAULT_THEME;
}
