/**
 * Static audit of the Supabase migrations.
 *
 * This test doesn't talk to Postgres — it parses the raw SQL files in
 * supabase/migrations and asserts the invariants we care about:
 *
 *   1. Every tenant-owned table has `workspace_id` on its own row
 *      (no join gymnastics — RLS must be a single-column equality).
 *   2. Every tenant-owned table has `enable row level security`.
 *   3. Every tenant-owned table also has `force row level security`
 *      (so the table-owning role doesn't silently bypass RLS).
 *   4. Every tenant-owned table has at least one policy using
 *      `public.current_workspace_id()` OR a membership subquery.
 *   5. The access token hook exists and writes into app_metadata.
 *
 * If a future migration adds a new tenant table and forgets any of
 * the above, CI fails here — loudly — before it ever ships.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const MIGRATIONS_DIR = join(
  process.cwd(),
  "supabase",
  "migrations",
);

function loadAllSql(): string {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  return files
    .map((f) => readFileSync(join(MIGRATIONS_DIR, f), "utf8"))
    .join("\n")
    .toLowerCase();
}

const TENANT_TABLES = [
  "workspaces",
  "workspace_members",
  "forms",
  "form_fields",
  "form_versions",
  "leads",
  "integrations",
  "audit_log",
] as const;

// Tables that scope by membership rather than by a workspace_id column
// on the row itself. `workspaces` is the anchor (its id IS the workspace
// id) and `workspace_members` stores the membership directly.
const ANCHOR_TABLES = new Set(["workspaces", "workspace_members"]);

describe("migration audit — multi-tenant invariants", () => {
  const sql = loadAllSql();

  it.each(TENANT_TABLES)(
    "%s has row level security enabled",
    (table) => {
      expect(sql).toContain(
        `alter table public.${table} enable row level security`,
      );
    },
  );

  it.each(TENANT_TABLES)(
    "%s has row level security FORCED (blocks table owner bypass)",
    (table) => {
      expect(sql).toContain(
        `alter table public.${table} force  row level security`,
      );
    },
  );

  it.each(
    TENANT_TABLES.filter((t) => !ANCHOR_TABLES.has(t)),
  )("%s carries a workspace_id column on the row", (table) => {
    // Match `create table public.<name> ( ... workspace_id uuid ... )`
    const createPattern = new RegExp(
      `create table public\\.${table}\\s*\\(([\\s\\S]*?)\\);`,
      "m",
    );
    const match = createPattern.exec(sql);
    expect(
      match,
      `expected create table public.${table} in migrations`,
    ).not.toBeNull();
    expect(match![1]).toMatch(/workspace_id\s+uuid/);
  });

  it.each(
    TENANT_TABLES.filter((t) => !ANCHOR_TABLES.has(t)),
  )("%s has at least one policy using current_workspace_id()", (table) => {
    // A policy block looks like:
    //   create policy "name" on public.<table> for <action> ...
    const policyRegex = new RegExp(
      `create policy\\s+"[^"]+"\\s+on\\s+public\\.${table}[\\s\\S]*?;`,
      "g",
    );
    const policies = sql.match(policyRegex) ?? [];
    expect(
      policies.length,
      `expected at least one policy on public.${table}`,
    ).toBeGreaterThan(0);
    const usesHelper = policies.some((p) =>
      p.includes("public.current_workspace_id()"),
    );
    expect(
      usesHelper,
      `at least one policy on ${table} should use public.current_workspace_id()`,
    ).toBe(true);
  });

  it("workspaces policy scopes reads to members only", () => {
    // workspaces is the anchor: its read policy must filter by
    // membership, not by current_workspace_id (which IS the workspace).
    const block =
      /create policy[^;]*on public\.workspaces for select[^;]*workspace_members[^;]*;/m;
    expect(sql).toMatch(block);
  });

  it("audit_log is append-only (reject trigger exists)", () => {
    expect(sql).toContain("raise exception 'audit_log is append-only'");
    expect(sql).toContain("audit_log_no_update");
    expect(sql).toContain("audit_log_no_delete");
  });

  it("integrations does NOT expose writes to authenticated users", () => {
    // We deliberately have no insert/update/delete policies on
    // integrations — tokens are written via service role after
    // encryption. Make sure someone doesn't quietly add one later.
    const writePolicy =
      /create policy[^;]*on public\.integrations for (insert|update|delete)[^;]*;/m;
    expect(sql).not.toMatch(writePolicy);
  });

  it("custom_access_token_hook writes app_metadata.workspace_id", () => {
    expect(sql).toContain("create or replace function public.custom_access_token_hook");
    expect(sql).toMatch(/\{app_metadata,workspace_id\}/);
    expect(sql).toContain(
      "grant execute on function public.custom_access_token_hook(jsonb)",
    );
    expect(sql).toContain("to supabase_auth_admin");
  });

  it("current_workspace_id() is security definer with locked search_path", () => {
    const fnBlock =
      /create or replace function public\.current_workspace_id[\s\S]*?\$\$;/m;
    const match = fnBlock.exec(sql);
    expect(match, "current_workspace_id() must exist").not.toBeNull();
    expect(match![0]).toContain("security definer");
    expect(match![0]).toContain("set search_path = ''");
  });
});
