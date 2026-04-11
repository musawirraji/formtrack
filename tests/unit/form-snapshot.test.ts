/**
 * buildSnapshot is the pure boundary between the authoring surface
 * (mutable form rows) and the publishing surface (immutable,
 * deterministic JSON that the embed script consumes). It has to be
 * deterministic and it has to be total — every code path that
 * serializes a snapshot must produce identical output given
 * identical input.
 */

import { describe, expect, it } from "vitest";

import { DEFAULT_THEME } from "@/domain/form/theme";
import {
  buildSnapshot,
  SNAPSHOT_VERSION,
  type FormSnapshotField,
} from "@/domain/form/snapshot";

const baseField: FormSnapshotField = {
  id: "f1",
  type: "short_text",
  label: "Name",
  placeholder: null,
  helpText: null,
  required: true,
  options: [],
  stepIndex: 0,
  displayOrder: 0,
};

describe("buildSnapshot", () => {
  it("pins the schema version", () => {
    const snap = buildSnapshot({
      formId: "form1",
      workspaceId: "ws1",
      slug: "contact",
      title: "Contact",
      theme: DEFAULT_THEME,
      submitButtonLabel: "Send",
      successMessage: "Thanks",
      fields: [baseField],
      version: 1,
      publishedAt: "2026-04-11T12:00:00Z",
    });
    expect(snap.schemaVersion).toBe(SNAPSHOT_VERSION);
  });

  it("sorts fields by (stepIndex, displayOrder) deterministically", () => {
    const shuffled: FormSnapshotField[] = [
      { ...baseField, id: "b", displayOrder: 2, stepIndex: 0 },
      { ...baseField, id: "a", displayOrder: 1, stepIndex: 0 },
      { ...baseField, id: "d", displayOrder: 0, stepIndex: 1 },
      { ...baseField, id: "c", displayOrder: 0, stepIndex: 0 },
    ];
    const snap = buildSnapshot({
      formId: "f",
      workspaceId: "w",
      slug: "s",
      title: "T",
      theme: DEFAULT_THEME,
      submitButtonLabel: "Send",
      successMessage: "Thanks",
      fields: shuffled,
      version: 1,
      publishedAt: "2026-04-11T12:00:00Z",
    });
    expect(snap.fields.map((f) => f.id)).toEqual(["c", "a", "b", "d"]);
  });

  it("is deterministic: same input yields structurally identical output", () => {
    const inputs = {
      formId: "f",
      workspaceId: "w",
      slug: "s",
      title: "T",
      theme: DEFAULT_THEME,
      submitButtonLabel: "Send",
      successMessage: "Thanks",
      fields: [baseField, { ...baseField, id: "f2", displayOrder: 1 }],
      version: 3,
      publishedAt: "2026-04-11T12:00:00Z",
    };
    expect(JSON.stringify(buildSnapshot(inputs))).toEqual(
      JSON.stringify(buildSnapshot(inputs)),
    );
  });

  it("does not mutate the input field array", () => {
    const fields = [
      { ...baseField, id: "b", displayOrder: 2 },
      { ...baseField, id: "a", displayOrder: 1 },
    ];
    const before = fields.map((f) => f.id);
    buildSnapshot({
      formId: "f",
      workspaceId: "w",
      slug: "s",
      title: "T",
      theme: DEFAULT_THEME,
      submitButtonLabel: "Send",
      successMessage: "Thanks",
      fields,
      version: 1,
      publishedAt: "2026-04-11T12:00:00Z",
    });
    expect(fields.map((f) => f.id)).toEqual(before);
  });
});
