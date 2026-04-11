/**
 * Pin the form domain validation + theme defaults. These rules are
 * the entire contract between the form builder UI, the server
 * actions, and the Postgres CHECK constraints — if any of them drift,
 * we want a loud failure here.
 */

import { describe, expect, it } from "vitest";

import {
  DEFAULT_THEME,
  formThemeSchema,
  parseTheme,
} from "@/domain/form/theme";
import {
  formCreateSchema,
  formFieldInputSchema,
  titleToSlug,
} from "@/domain/form/validation";

describe("formThemeSchema", () => {
  it("accepts the default theme", () => {
    expect(formThemeSchema.safeParse(DEFAULT_THEME).success).toBe(true);
  });

  it("rejects non-hex accents", () => {
    const r = formThemeSchema.safeParse({
      ...DEFAULT_THEME,
      accent: "purple",
    });
    expect(r.success).toBe(false);
  });

  it("rejects 3-digit hex (we require full 6-digit form)", () => {
    const r = formThemeSchema.safeParse({
      ...DEFAULT_THEME,
      accent: "#abc",
    });
    expect(r.success).toBe(false);
  });

  it("rejects unknown fonts", () => {
    const r = formThemeSchema.safeParse({
      ...DEFAULT_THEME,
      font: "comic-sans",
    });
    expect(r.success).toBe(false);
  });
});

describe("parseTheme", () => {
  it("returns the parsed theme when valid", () => {
    const parsed = parseTheme({
      accent: "#0A84FF",
      font: "inter",
      corners: "sharp",
    });
    expect(parsed.accent).toBe("#0A84FF");
  });

  it("falls back to DEFAULT_THEME on any malformed value", () => {
    expect(parseTheme(null)).toEqual(DEFAULT_THEME);
    expect(parseTheme({ accent: "not-a-color" })).toEqual(DEFAULT_THEME);
    expect(parseTheme("totally wrong type")).toEqual(DEFAULT_THEME);
  });
});

describe("formFieldInputSchema", () => {
  it("accepts a basic short_text field", () => {
    const r = formFieldInputSchema.safeParse({
      type: "short_text",
      label: "First name",
      required: true,
      displayOrder: 0,
    });
    expect(r.success).toBe(true);
  });

  it("requires options on dropdown fields", () => {
    const r = formFieldInputSchema.safeParse({
      type: "dropdown",
      label: "Service",
      required: false,
      displayOrder: 1,
    });
    expect(r.success).toBe(false);
  });

  it("requires options on radio fields", () => {
    const r = formFieldInputSchema.safeParse({
      type: "radio",
      label: "Plan",
      required: false,
      options: [],
      displayOrder: 0,
    });
    expect(r.success).toBe(false);
  });

  it("accepts optioned fields when options are populated", () => {
    const r = formFieldInputSchema.safeParse({
      type: "dropdown",
      label: "Service",
      options: ["Consulting", "Implementation", "Training"],
      required: true,
      displayOrder: 0,
    });
    expect(r.success).toBe(true);
  });

  it("rejects empty labels", () => {
    const r = formFieldInputSchema.safeParse({
      type: "short_text",
      label: "   ",
      required: false,
      displayOrder: 0,
    });
    expect(r.success).toBe(false);
  });
});

describe("formCreateSchema", () => {
  it("accepts a title-only payload", () => {
    expect(formCreateSchema.safeParse({ title: "Get a quote" }).success).toBe(
      true,
    );
  });

  it("trims titles", () => {
    const r = formCreateSchema.safeParse({ title: "  Contact  " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.title).toBe("Contact");
  });

  it("rejects slugs that don't match the DB constraint", () => {
    const r = formCreateSchema.safeParse({
      title: "Contact",
      slug: "Has Spaces",
    });
    expect(r.success).toBe(false);
  });

  it("accepts up to 100 initial fields", () => {
    const fields = Array.from({ length: 100 }, (_, i) => ({
      type: "short_text" as const,
      label: `Field ${i}`,
      required: false,
      displayOrder: i,
    }));
    expect(formCreateSchema.safeParse({ title: "Mega", fields }).success).toBe(
      true,
    );
  });

  it("rejects over 100 fields", () => {
    const fields = Array.from({ length: 101 }, (_, i) => ({
      type: "short_text" as const,
      label: `Field ${i}`,
      required: false,
      displayOrder: i,
    }));
    expect(formCreateSchema.safeParse({ title: "Mega", fields }).success).toBe(
      false,
    );
  });
});

describe("titleToSlug", () => {
  it("lowercases + dashes punctuation", () => {
    expect(titleToSlug("Get a Quote!")).toBe("get-a-quote");
  });

  it("strips diacritics", () => {
    expect(titleToSlug("Résumé")).toBe("resume");
  });

  it("collapses runs of non-alphanumerics", () => {
    expect(titleToSlug("Hello    world!!!")).toBe("hello-world");
  });

  it("falls back to 'form' for empty/unprintable input", () => {
    expect(titleToSlug("   ")).toBe("form");
    expect(titleToSlug("")).toBe("form");
  });

  it("caps at 60 characters", () => {
    const slug = titleToSlug("x".repeat(120));
    expect(slug.length).toBeLessThanOrEqual(60);
  });
});
