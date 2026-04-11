// Pure workspace-slug helper. Lives in its own module so it can be
// imported from both the server action file (which is `"use server"`
// and therefore forbidden from exporting non-async functions) and
// unit tests.
export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  // Slug regex in migration 0001 requires 3+ chars and alphanumeric ends.
  const withSuffix = base.length < 3 ? `${base}-ws` : base;
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${withSuffix}-${suffix}`.replace(/^-+|-+$/g, "").slice(0, 50);
}
