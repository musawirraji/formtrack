/**
 * Pins the server-side submission validator. The embed script does
 * client-side validation for UX, but the API route re-validates
 * because attackers can forge submissions.
 */

import { describe, expect, it } from "vitest";

import { DEFAULT_THEME } from "@/domain/form/theme";
import { SNAPSHOT_VERSION, type FormSnapshot } from "@/domain/form/snapshot";
import { validateAgainstSnapshot } from "@/features/submissions/application/submit.service";
import { renderTemplate } from "@/features/autoReply/application/autoReply.service";

const snapshot: FormSnapshot = {
  schemaVersion: SNAPSHOT_VERSION,
  formId: "form1",
  workspaceId: "ws1",
  slug: "contact",
  title: "Contact",
  theme: DEFAULT_THEME,
  submitButtonLabel: "Send",
  successMessage: "Thanks",
  version: 1,
  publishedAt: "2026-04-11T00:00:00Z",
  fields: [
    {
      id: "name",
      type: "short_text",
      label: "Full name",
      placeholder: null,
      helpText: null,
      required: true,
      options: [],
      stepIndex: 0,
      displayOrder: 0,
    },
    {
      id: "email",
      type: "email",
      label: "Email",
      placeholder: null,
      helpText: null,
      required: true,
      options: [],
      stepIndex: 0,
      displayOrder: 1,
    },
    {
      id: "plan",
      type: "dropdown",
      label: "Plan",
      placeholder: null,
      helpText: null,
      required: false,
      options: ["Starter", "Growth", "Business"],
      stepIndex: 0,
      displayOrder: 2,
    },
    {
      id: "perks",
      type: "checkbox",
      label: "Perks",
      placeholder: null,
      helpText: null,
      required: false,
      options: ["Support", "Priority", "SLA"],
      stepIndex: 0,
      displayOrder: 3,
    },
  ],
};

describe("validateAgainstSnapshot", () => {
  it("flags missing required fields", () => {
    const errors = validateAgainstSnapshot(snapshot, {});
    expect(errors.name).toBeDefined();
    expect(errors.email).toBeDefined();
    expect(errors.plan).toBeUndefined();
  });

  it("flags empty/whitespace required values", () => {
    const errors = validateAgainstSnapshot(snapshot, {
      name: "   ",
      email: "",
    });
    expect(errors.name).toBeDefined();
    expect(errors.email).toBeDefined();
  });

  it("accepts a well-formed payload", () => {
    const errors = validateAgainstSnapshot(snapshot, {
      name: "Jane",
      email: "jane@example.com",
      plan: "Growth",
      perks: ["Support", "SLA"],
    });
    expect(errors).toEqual({});
  });

  it("rejects malformed emails", () => {
    const errors = validateAgainstSnapshot(snapshot, {
      name: "Jane",
      email: "not-an-email",
    });
    expect(errors.email).toBeDefined();
  });

  it("rejects dropdown values outside the allowed options", () => {
    const errors = validateAgainstSnapshot(snapshot, {
      name: "Jane",
      email: "jane@example.com",
      plan: "Unlimited",
    });
    expect(errors.plan).toBeDefined();
  });

  it("rejects checkbox values outside the allowed options", () => {
    const errors = validateAgainstSnapshot(snapshot, {
      name: "Jane",
      email: "jane@example.com",
      perks: ["Support", "Hax"],
    });
    expect(errors.perks).toBeDefined();
  });

  it("accepts omitting optional fields entirely", () => {
    const errors = validateAgainstSnapshot(snapshot, {
      name: "Jane",
      email: "jane@example.com",
    });
    expect(errors).toEqual({});
  });
});

describe("renderTemplate", () => {
  it("substitutes {{vars}}", () => {
    expect(
      renderTemplate("Hi {{name}}, we got your message at {{email}}.", {
        name: "Jane",
        email: "jane@example.com",
      }),
    ).toBe("Hi Jane, we got your message at jane@example.com.");
  });

  it("leaves unknown keys empty", () => {
    expect(renderTemplate("Hi {{name}}{{nope}}", { name: "Jane" })).toBe(
      "Hi Jane",
    );
  });

  it("handles whitespace inside braces", () => {
    expect(renderTemplate("Hi {{ name }}", { name: "Jane" })).toBe("Hi Jane");
  });
});
