/**
 * Pin the auth schemas. These regexes + bounds are a tiny surface
 * area that's easy to "fix" and regress later, so we lock them down
 * before any real auth traffic touches them.
 */

import { describe, expect, it } from "vitest";

import {
  loginSchema,
  magicLinkSchema,
  signupSchema,
} from "@/features/auth/application/schemas";
import { slugify } from "@/features/auth/application/slugify";

describe("loginSchema", () => {
  it("accepts a valid email + 10-char password", () => {
    expect(
      loginSchema.safeParse({
        email: "oba@example.com",
        password: "hunter2hunter",
      }).success,
    ).toBe(true);
  });

  it("rejects short passwords", () => {
    const r = loginSchema.safeParse({
      email: "oba@example.com",
      password: "short",
    });
    expect(r.success).toBe(false);
  });

  it("rejects malformed emails", () => {
    const r = loginSchema.safeParse({
      email: "not-an-email",
      password: "hunter2hunter",
    });
    expect(r.success).toBe(false);
  });

  it("trims leading/trailing whitespace from emails", () => {
    const r = loginSchema.safeParse({
      email: "  oba@example.com  ",
      password: "hunter2hunter",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.email).toBe("oba@example.com");
    }
  });
});

describe("signupSchema", () => {
  it("requires a workspace name", () => {
    const r = signupSchema.safeParse({
      email: "oba@example.com",
      password: "hunter2hunter",
      workspaceName: "",
    });
    expect(r.success).toBe(false);
  });

  it("caps workspace name at 80 chars", () => {
    const r = signupSchema.safeParse({
      email: "oba@example.com",
      password: "hunter2hunter",
      workspaceName: "x".repeat(81),
    });
    expect(r.success).toBe(false);
  });
});

describe("magicLinkSchema", () => {
  it("only requires a valid email", () => {
    expect(magicLinkSchema.safeParse({ email: "oba@example.com" }).success).toBe(
      true,
    );
    expect(magicLinkSchema.safeParse({ email: "" }).success).toBe(false);
  });
});

describe("slugify", () => {
  it("lowercases, strips punctuation, and appends a random suffix", () => {
    const slug = slugify("Acme Co");
    expect(slug).toMatch(/^acme-co-[a-z0-9]{6}$/);
  });

  it("strips diacritics via NFKD", () => {
    const slug = slugify("Café Résumé");
    expect(slug).toMatch(/^cafe-resume-[a-z0-9]{6}$/);
  });

  it("pads short names so they satisfy the slug regex", () => {
    const slug = slugify("A");
    // slug regex in 0001: ^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$
    expect(slug.length).toBeGreaterThanOrEqual(5);
    expect(slug).toMatch(/^[a-z0-9][a-z0-9-]+[a-z0-9]$/);
  });

  it("never emits leading or trailing dashes", () => {
    const slug = slugify("!!!acme!!!");
    expect(slug.startsWith("-")).toBe(false);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("caps length so Postgres won't reject it", () => {
    const slug = slugify("x".repeat(200));
    expect(slug.length).toBeLessThanOrEqual(50);
  });
});
