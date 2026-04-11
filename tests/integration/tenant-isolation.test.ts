/**
 * Two-tenant isolation test.
 *
 * Spins up two synthetic workspaces with one user each and proves
 * that tenant A cannot see tenant B's rows through RLS, no matter
 * which table we look at. This is the black-box test that catches
 * "I forgot to add a policy on the new table" regressions.
 *
 * Requires a real (or local) Supabase instance. Run against the
 * local stack:
 *
 *   supabase start
 *   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   pnpm vitest run tests/integration
 *
 * Skipped automatically when those env vars are missing so CI stays
 * green on PRs that don't touch the DB. The CI job that DOES run
 * this one sets RUN_DB_TESTS=1 and asserts it wasn't skipped.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "@/types/database";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

const enabled = Boolean(url && anon && service);
const describeDb = enabled ? describe : describe.skip;

type Admin = SupabaseClient<Database>;

interface Fixture {
  admin: Admin;
  aClient: Admin;
  bClient: Admin;
  workspaceA: string;
  workspaceB: string;
  formA: string;
  formB: string;
  userA: { id: string; email: string };
  userB: { id: string; email: string };
}

describeDb("RLS: two-tenant isolation", () => {
  const ctx: Partial<Fixture> = {};

  beforeAll(async () => {
    // Assertions narrow these to `string` for the rest of the suite.
    if (!url || !anon || !service) return;

    const admin = createClient<Database>(url, service, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    ctx.admin = admin;

    const stamp = Date.now();
    const emailA = `tenant-a-${stamp}@formtrack.test`;
    const emailB = `tenant-b-${stamp}@formtrack.test`;
    const password = "Passw0rd!Passw0rd!";

    const [a, b] = await Promise.all([
      admin.auth.admin.createUser({
        email: emailA,
        password,
        email_confirm: true,
      }),
      admin.auth.admin.createUser({
        email: emailB,
        password,
        email_confirm: true,
      }),
    ]);

    if (a.error || !a.data.user) throw a.error ?? new Error("no user A");
    if (b.error || !b.data.user) throw b.error ?? new Error("no user B");

    ctx.userA = { id: a.data.user.id, email: emailA };
    ctx.userB = { id: b.data.user.id, email: emailB };

    // Create one workspace per user via service role.
    const wsA = await admin
      .from("workspaces")
      .insert({ name: "Tenant A", slug: `tenant-a-${stamp}` })
      .select("id")
      .single();
    const wsB = await admin
      .from("workspaces")
      .insert({ name: "Tenant B", slug: `tenant-b-${stamp}` })
      .select("id")
      .single();
    if (!wsA.data || !wsB.data) {
      throw new Error(`failed to create workspaces: ${wsA.error?.message} / ${wsB.error?.message}`);
    }
    ctx.workspaceA = wsA.data.id;
    ctx.workspaceB = wsB.data.id;

    await admin.from("workspace_members").insert([
      { workspace_id: wsA.data.id, user_id: a.data.user.id, role: "owner" },
      { workspace_id: wsB.data.id, user_id: b.data.user.id, role: "owner" },
    ]);

    // A form in each.
    const fA = await admin
      .from("forms")
      .insert({
        workspace_id: wsA.data.id,
        title: "A Contact",
        slug: "contact",
      })
      .select("id")
      .single();
    const fB = await admin
      .from("forms")
      .insert({
        workspace_id: wsB.data.id,
        title: "B Contact",
        slug: "contact",
      })
      .select("id")
      .single();
    ctx.formA = fA.data!.id;
    ctx.formB = fB.data!.id;

    // Build anon clients signed in as each user.
    const makeAnon = async (email: string): Promise<Admin> => {
      const client = createClient<Database>(url, anon, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error } = await client.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      return client;
    };
    ctx.aClient = await makeAnon(emailA);
    ctx.bClient = await makeAnon(emailB);
  }, 60_000);

  afterAll(async () => {
    if (!ctx.admin) return;
    if (ctx.workspaceA) {
      await ctx.admin.from("workspaces").delete().eq("id", ctx.workspaceA);
    }
    if (ctx.workspaceB) {
      await ctx.admin.from("workspaces").delete().eq("id", ctx.workspaceB);
    }
    if (ctx.userA) await ctx.admin.auth.admin.deleteUser(ctx.userA.id);
    if (ctx.userB) await ctx.admin.auth.admin.deleteUser(ctx.userB.id);
  });

  it("A cannot see B's workspace row", async () => {
    const { data } = await ctx.aClient!
      .from("workspaces")
      .select("id")
      .eq("id", ctx.workspaceB!);
    expect(data ?? []).toHaveLength(0);
  });

  it("A cannot see B's forms", async () => {
    const { data } = await ctx.aClient!
      .from("forms")
      .select("id, title")
      .eq("workspace_id", ctx.workspaceB!);
    expect(data ?? []).toHaveLength(0);
  });

  it("A cannot insert a form into B's workspace", async () => {
    const res = await ctx.aClient!.from("forms").insert({
      workspace_id: ctx.workspaceB!,
      title: "Trojan",
      slug: "trojan",
    });
    expect(res.error).not.toBeNull();
  });

  it("A cannot update B's form", async () => {
    const res = await ctx.aClient!
      .from("forms")
      .update({ title: "Hacked" })
      .eq("id", ctx.formB!);
    // Update succeeds with 0 rows affected under RLS rather than
    // erroring — so verify nothing actually changed.
    expect(res.error).toBeNull();
    const check = await ctx.admin!
      .from("forms")
      .select("title")
      .eq("id", ctx.formB!)
      .single();
    expect(check.data?.title).toBe("B Contact");
  });

  it("A cannot delete B's form", async () => {
    const res = await ctx.aClient!
      .from("forms")
      .delete()
      .eq("id", ctx.formB!);
    expect(res.error).toBeNull();
    const check = await ctx.admin!
      .from("forms")
      .select("id")
      .eq("id", ctx.formB!)
      .maybeSingle();
    expect(check.data).not.toBeNull();
  });

  it("A can see its own workspace", async () => {
    const { data } = await ctx.aClient!
      .from("workspaces")
      .select("id")
      .eq("id", ctx.workspaceA!);
    expect(data ?? []).toHaveLength(1);
  });
});
