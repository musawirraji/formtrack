/**
 * Every starter template must round-trip cleanly through the same
 * validation schemas a user-authored form goes through. If a template
 * ever lands invalid here, the `createFormFromTemplateAction` server
 * action would throw a zod error on the user's first click — tests
 * make that impossible to ship.
 */

import { describe, expect, it } from "vitest";

import { FORM_TEMPLATES, getTemplate } from "@/domain/form/templates";
import { formThemeSchema } from "@/domain/form/theme";
import {
  formCreateSchema,
  formFieldInputSchema,
  OPTIONED_FIELD_TYPES,
} from "@/domain/form/validation";
import { toFieldDTO } from "@/features/forms/application/fields.service";
import type { Tables } from "@/types/database";

describe("FORM_TEMPLATES", () => {
  it("contains the eight documented templates in a stable order", () => {
    expect(FORM_TEMPLATES.map((t) => t.key)).toEqual([
      "contact",
      "consultation",
      "quote",
      "newsletter",
      "booking",
      "feedback",
      "rsvp",
      "waitlist",
    ]);
  });

  it("has unique keys", () => {
    const keys = new Set(FORM_TEMPLATES.map((t) => t.key));
    expect(keys.size).toBe(FORM_TEMPLATES.length);
  });

  it("every template passes formCreateSchema as a whole", () => {
    for (const template of FORM_TEMPLATES) {
      const r = formCreateSchema.safeParse({
        title: template.defaultFormTitle,
        theme: template.theme,
        submitButtonLabel: template.submitButtonLabel,
        successMessage: template.successMessage,
        fields: template.fields,
      });
      if (!r.success) {
        throw new Error(
          `Template "${template.key}" failed formCreateSchema: ${r.error.message}`,
        );
      }
    }
  });

  it("every template's theme passes formThemeSchema", () => {
    for (const template of FORM_TEMPLATES) {
      expect(formThemeSchema.safeParse(template.theme).success).toBe(true);
    }
  });

  it("every template field passes formFieldInputSchema independently", () => {
    for (const template of FORM_TEMPLATES) {
      template.fields.forEach((field, i) => {
        const r = formFieldInputSchema.safeParse(field);
        if (!r.success) {
          throw new Error(
            `Template "${template.key}" field[${i}] (${field.label}) failed: ${r.error.message}`,
          );
        }
      });
    }
  });

  it("optioned fields always ship with non-empty options", () => {
    for (const template of FORM_TEMPLATES) {
      for (const field of template.fields) {
        if (OPTIONED_FIELD_TYPES.has(field.type)) {
          expect(field.options && field.options.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("displayOrder is monotonic within each template", () => {
    for (const template of FORM_TEMPLATES) {
      const orders = template.fields.map((f) => f.displayOrder);
      const sorted = [...orders].sort((a, b) => a - b);
      expect(orders).toEqual(sorted);
    }
  });

  it("every template has a non-empty submit copy + success message", () => {
    for (const template of FORM_TEMPLATES) {
      expect(template.submitButtonLabel.length).toBeGreaterThan(0);
      expect(template.successMessage.length).toBeGreaterThan(0);
      expect(template.defaultFormTitle.length).toBeGreaterThan(0);
      expect(template.badge.length).toBeGreaterThan(0);
    }
  });
});

describe("getTemplate", () => {
  it("returns the template for a known key", () => {
    expect(getTemplate("contact").key).toBe("contact");
  });

  it("throws for unknown keys", () => {
    // @ts-expect-error — intentionally wrong type
    expect(() => getTemplate("not-real")).toThrow();
  });
});

describe("toFieldDTO", () => {
  const baseRow: Tables<"form_fields"> = {
    id: "00000000-0000-0000-0000-000000000001",
    form_id: "00000000-0000-0000-0000-00000000aaaa",
    workspace_id: "00000000-0000-0000-0000-00000000bbbb",
    type: "short_text",
    label: "Name",
    placeholder: null,
    help_text: null,
    required: true,
    options: [],
    step_index: 0,
    display_order: 0,
    created_at: "2026-04-11T00:00:00Z",
  };

  it("maps snake_case row columns into camelCase DTO fields", () => {
    const dto = toFieldDTO({
      ...baseRow,
      placeholder: "Jane Doe",
      help_text: "Your legal name",
      display_order: 3,
      step_index: 1,
    });
    expect(dto).toMatchObject({
      id: baseRow.id,
      formId: baseRow.form_id,
      placeholder: "Jane Doe",
      helpText: "Your legal name",
      displayOrder: 3,
      stepIndex: 1,
      required: true,
    });
  });

  it("filters non-string option entries defensively", () => {
    const dto = toFieldDTO({
      ...baseRow,
      type: "dropdown",
      // jsonb can technically hold any JSON — mapper should drop non-strings
      options: ["One", 2, null, "Three", { nested: "nope" }] as unknown as [],
    });
    expect(dto.options).toEqual(["One", "Three"]);
  });

  it("returns an empty array when options is not an array", () => {
    const dto = toFieldDTO({
      ...baseRow,
      options: null as unknown as [],
    });
    expect(dto.options).toEqual([]);
  });
});
