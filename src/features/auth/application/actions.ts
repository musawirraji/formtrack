"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { createAdminSupabase } from "@/infrastructure/supabase/admin";
import { createServerSupabase } from "@/infrastructure/supabase/server";

import {
  loginSchema,
  magicLinkSchema,
  signupSchema,
} from "./schemas";
import { slugify } from "./slugify";

/**
 * Shape every auth action returns on failure. Success redirects via
 * Next.js's `redirect()` so the component never sees a success case.
 */
export interface ActionError {
  readonly ok: false;
  readonly error: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
}

function zodErrors(err: unknown): Readonly<Record<string, string>> {
  if (err && typeof err === "object" && "issues" in err) {
    const issues = (err as { issues: { path: (string | number)[]; message: string }[] })
      .issues;
    const fieldErrors: Record<string, string> = {};
    for (const issue of issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    return fieldErrors;
  }
  return {};
}

async function getSiteUrl(): Promise<string> {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) return envUrl;
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

// ─── Login with email + password ─────────────────────────────
export async function loginWithPassword(
  _prev: ActionError | null,
  formData: FormData,
): Promise<ActionError> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: zodErrors(parsed.error),
    };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { ok: false, error: "Email or password is incorrect." };
  }

  redirect("/dashboard");
}

// ─── Sign up + create the user's first workspace ────────────
export async function signupWithPassword(
  _prev: ActionError | null,
  formData: FormData,
): Promise<ActionError> {
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    workspaceName: formData.get("workspaceName"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: zodErrors(parsed.error),
    };
  }

  const supabase = await createServerSupabase();
  const siteUrl = await getSiteUrl();

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback`,
    },
  });
  if (error || !data.user) {
    return {
      ok: false,
      error: error?.message ?? "Could not create your account.",
    };
  }

  // Bootstrap: create the workspace + membership using the service
  // role. The access token hook will then pick this workspace on the
  // user's next token issue. We never let users INSERT workspaces
  // through the anon client (no policy allows it), so this is the
  // one sanctioned write-path.
  const admin = createAdminSupabase();
  const slug = slugify(parsed.data.workspaceName);

  const { data: workspace, error: wsError } = await admin
    .from("workspaces")
    .insert({ name: parsed.data.workspaceName, slug })
    .select("id")
    .single();
  if (wsError || !workspace) {
    return {
      ok: false,
      error: "Account created but workspace setup failed. Contact support.",
    };
  }

  const { error: memberError } = await admin.from("workspace_members").insert({
    workspace_id: workspace.id,
    user_id: data.user.id,
    role: "owner",
  });
  if (memberError) {
    return {
      ok: false,
      error: "Account created but workspace setup failed. Contact support.",
    };
  }

  // If email confirmation is off (local dev), a session already exists.
  // If it's on (production), data.session is null and the user needs to
  // click the confirmation link — send them to a check-your-email page.
  if (!data.session) {
    redirect("/signup/verify");
  }
  redirect("/dashboard");
}

// ─── Magic link fallback ────────────────────────────────────
export async function sendMagicLink(
  _prev: ActionError | null,
  formData: FormData,
): Promise<ActionError> {
  const parsed = magicLinkSchema.safeParse({
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Enter a valid email address.",
      fieldErrors: zodErrors(parsed.error),
    };
  }

  const supabase = await createServerSupabase();
  const siteUrl = await getSiteUrl();

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: `${siteUrl}/auth/callback` },
  });
  if (error) {
    return { ok: false, error: "Could not send the magic link. Try again." };
  }

  redirect("/login/sent");
}

// ─── Logout ─────────────────────────────────────────────────
export async function logoutAction(): Promise<void> {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect("/login");
}

// `slugify` moved to ./slugify.ts — "use server" files can only export
// async functions, so we keep sync helpers in a plain module next door.
