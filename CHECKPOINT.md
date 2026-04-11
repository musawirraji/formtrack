# FormTrack — Build Checkpoints

Per the client's process: after every build step, append an entry documenting what was built, which tests now pass, and any decisions or open questions.

---

## Step 1 — Foundation ✅

**Built**

- Next.js 16.1.7 + React 19.2.3 + TypeScript strict (`noUncheckedIndexedAccess`, `noImplicitOverride`)
- SCSS modules with a global `_tokens.scss` + `_mixins.scss` auto-prepended via `next.config.ts > sassOptions.prependData`
- Design token layer (Altera-inspired palette, locked with the client):
  - Dark-first surfaces (`#0B0B12` / `#15151E` / `#1C1C27`)
  - Light auto-swap via `prefers-color-scheme` + `[data-theme="light|dark"]` override
  - Accent `#7C6BFF`, positive `#6EE7A0`, negative `#FF7A93`
  - Inter Tight (display) + Inter (UI) + JetBrains Mono
  - Radii 10 / 14 / 20 / 28 / pill, 4pt spacing scale, motion `cubic-bezier(.2,.8,.2,1)` @ 180ms
- Feature-sliced folder structure mirroring postpilot/drafter:
  - `app/` · thin route group scaffold (`(app)`, `(auth)`, `api/`)
  - `src/features/` · dashboard, forms, auth shells ready
  - `src/shared/` · `design/`, `components/` (Button, Card, Badge), `layout/`
  - `src/domain/` · pure TS — `Form`, `Lead`, `Workspace`, `AttributionSource`
  - `src/infrastructure/supabase/` · browser, server, admin clients
  - `src/services/`, `src/types/`, `src/lib/`
- `embed/` — separate esbuild workspace with a placeholder IIFE entry (real implementation in step 7)
- Landing page (`app/page.tsx`) in the Altera style — gradient headline, pill CTAs, tokens in play
- `/api/health` liveness endpoint
- Vitest config with path aliases + sample unit tests
- Playwright config with webServer auto-start + smoke spec
- GitHub Actions CI: lint → typecheck → unit → build → E2E → upload report
- ESLint flat config (`next/core-web-vitals` + `next/typescript`)
- `.env.example` with every env var the project will need across all 13 steps
- Security headers (`next.config.ts`): `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`
- Embed-route CORS headers for `/embed/*`
- README with architecture, rules, and commands

**Tests passing**

- `tests/unit/attribution.test.ts` — 7 cases covering the attribution resolver:
  - Meta UTM trail → high confidence
  - Google Ads UTM → high confidence
  - `fbclid` only → medium
  - `gclid` only → medium
  - Google referrer host → medium, `google_organic`
  - No signals → low, `direct`
  - Malformed referrer → graceful fallback
  - Newsletter UTM → `email` high confidence
- `tests/unit/workspace.test.ts` — plan limits are defined, monotonic, business is unlimited
- `tests/e2e/smoke.spec.ts` — landing page renders with the hero + CTA, `/api/health` returns ok

**Decisions (to flag to the client)**

1. **Next.js 16.1.7** instead of 14 — matches the latest stable and aligns with our existing postpilot/drafter codebases. React 19.2.3.
2. **Vitest instead of Jest** — faster, same API surface, already proven in our codebases.
3. **SCSS modules instead of shadcn/ui** — deliberate design-quality choice. shadcn reads generic after 6 months; SCSS modules + tokens give us an Altera-grade look. Still using Tailwind-adjacent utility in `_mixins.scss` for DRY.
4. **esbuild for the embed script** — smaller output than Rollup, one config file, ideal for the <10KB target.
5. **Dark + light with OS auto-detect** (not a toggle) — matches reference aesthetic; toggle can ship later.
6. **Attribution resolver (`src/domain/lead/attribution.ts`) was implemented early** because it's the product's core promise ("plain-English explanation of which campaign drove the conversion") and should be testable before any UI lands.

**Open questions / awaiting client**

- [ ] Full 2,300-line spec so I can produce a diff vs. this plan before step 2.
- [ ] GitHub org + repo name → I'll push step 1 immediately once I have it.
- [ ] Supabase project created + keys added to repo secrets (for CI).
- [ ] Stripe test account → needed by step 12 but should be set up now to avoid a stall.
- [ ] Google OAuth client + Microsoft app registration → needed by step 10.

**Next**

→ **Step 2: Supabase schema + Row Level Security.** Workspaces, members, JWT-claim auth hook, RLS policies on every tenant table, and a two-tenant Playwright isolation test that proves tenant A cannot read tenant B's rows.

---

## Step 2 — Supabase schema + Row Level Security ✅

**Built**

- Seven ordered SQL migrations in `supabase/migrations/`:
  - `0001_workspaces.sql` — `workspaces`, `workspace_members`, extensions (`pgcrypto`, `uuid-ossp`), and the two helpers every RLS policy calls: `public.current_workspace_id()` (reads JWT `app_metadata.workspace_id`, falls back to top-level claim for fixtures) and `public.is_workspace_member(_ws, _user)`. Both `security definer` with `search_path = ''` locked down. Plus `touch_updated_at()` trigger function.
  - `0002_forms.sql` — `forms`, `form_fields`, `form_versions`. Key design call: `form_fields.workspace_id` is **denormalized** so RLS is a single-column equality instead of a join. Slug regex constraint, status check, one version row per publish.
  - `0003_leads.sql` — `leads` with the attribution resolver's output columns stored **inline** (`source_channel`, `source_label`, `source_campaign`, `source_referrer_host`, `source_explanation`, `source_confidence`). Raw `attribution_raw jsonb` retained for audit. IP stored only as `ip_hash`. Indexes for (workspace, created_at), (form, created_at), (workspace, source_channel), and a partial lower(email) index for search.
  - `0004_integrations.sql` — `integrations` table with `access_token_encrypted bytea` + `refresh_token_encrypted bytea`. Token encryption happens in the app layer before insert (key lives in `OAUTH_TOKEN_ENCRYPTION_KEY`). Adds the `forms.connected_inbox_id → integrations.id` FK that step 11 will rely on.
  - `0005_audit_log.sql` — append-only `audit_log` with bigserial PK and a trigger that raises on UPDATE/DELETE. No app code ever mutates this table; infra writes via service role.
  - `0006_rls_policies.sql` — the enforcement layer. Every tenant table gets `enable row level security` **and** `force row level security` (so the table-owning role can't bypass). Four actions (select/insert/update/delete) on `forms` and `form_fields` matching `workspace_id = public.current_workspace_id()`. `workspaces` filtered by membership subquery (it's the anchor). `integrations` and `audit_log` are admin-/owner-only read with no write policies at all — writes go exclusively through the service role.
  - `0007_access_token_hook.sql` — `custom_access_token_hook(event jsonb)` picks the oldest workspace the user is a member of and writes its id into `claims.app_metadata.workspace_id`. Granted to `supabase_auth_admin`, revoked from everyone else. Registered in `supabase/config.toml` under `[auth.hook.custom_access_token]`.
- `src/types/database.ts` — hand-written Row/Insert/Update types matching the migrations exactly (can be regenerated via `supabase gen types`). Includes `WorkspaceRole`, `FormFieldType`, `LeadSourceChannel`, `LeadSourceConfidence`, `IntegrationProvider`, `IntegrationStatus` unions and the declared Postgres functions.
- `src/lib/auth/requireWorkspace.ts` — server-side guard that returns `{ userId, email, workspace: { id, name, slug, plan, role } }`. Reads workspace id from the JWT claim written by the auth hook (falls back to a DB lookup if missing), then validates membership through the RLS-scoped client. Throws typed errors (`NotAuthenticatedError`, `NoWorkspaceError`, `InsufficientRoleError`). Companion `requireWorkspaceOrRedirect()` wraps those into Next.js redirects. Defense in depth on top of RLS so no feature code has to re-implement the check.
- `supabase/config.toml` — local dev config, Postgres 15, all ports, and the `custom_access_token` hook registration.

**Tests passing**

- `tests/unit/rls-audit.test.ts` — static audit of the migration files. Asserts, for every tenant table:
  - RLS is enabled
  - RLS is forced
  - Non-anchor tables carry a `workspace_id uuid` column on the row
  - At least one policy references `public.current_workspace_id()`
  - `workspaces` read policy filters by `workspace_members` (not by `current_workspace_id()`, because it IS the workspace)
  - `audit_log` has the append-only reject trigger
  - `integrations` has **no** insert/update/delete policies (guards against someone quietly adding one later)
  - `custom_access_token_hook` exists, writes `app_metadata.workspace_id`, and is granted to `supabase_auth_admin` only
  - `current_workspace_id()` is `security definer` with `search_path = ''`
- `tests/integration/tenant-isolation.test.ts` — the black-box isolation test. Creates two users, two workspaces, two forms, signs in as each anon client, and asserts:
  - A cannot read B's workspace row
  - A cannot read B's forms
  - A cannot insert a form into B's workspace (error)
  - A cannot update or delete B's form (verified by re-reading through the admin client)
  - A can still see its own workspace
  - Cleans up via `afterAll` so it can run repeatedly. Auto-skips when Supabase env vars are missing; the CI job that runs it sets `RUN_DB_TESTS=1`.

**Decisions (to flag to the client)**

1. **Denormalized `workspace_id` on `form_fields` and `form_versions`.** Trades a few bytes per row for single-column RLS policies that don't need a subquery into `forms`. At scale this is the difference between an index seek and a join at every query.
2. **`force row level security` everywhere.** Without this, the table owner (which is how Supabase migrations run) silently bypasses RLS. This is the single most common Supabase RLS bug in the wild — we're ruling it out at the schema level.
3. **`current_workspace_id()` is `security definer` with `search_path = ''`.** Standard PG hardening: prevents search-path attacks and lets the helper read JWT claims even when called from a restricted role.
4. **No INSERT policy on `leads`.** Public submissions come through the submissions API route (step 8) which uses the service-role client after rate-limiting + CAPTCHA. We never want random visitors to write to `leads` directly.
5. **No write policies on `integrations` or `audit_log`.** Tokens must be encrypted before landing on disk (step 10); audit rows must be immutable. Both are enforced by having zero writable policies + (for audit_log) a mutation-rejecting trigger.
6. **Auth hook picks the oldest workspace by default.** Simple, deterministic, and matches how people instinctively model "my primary workspace". Users with multiple workspaces get a picker later (step 3) that updates `app_metadata.workspace_id` via a server action + forced token refresh.
7. **`requireWorkspace()` is a defense-in-depth layer, not a replacement for RLS.** RLS is still the real boundary. The helper exists so feature code can trust `ctx.workspace.id` is real without re-implementing the membership check.

**Open questions / awaiting client**

- [ ] Supabase project id + keys → CI can't run the integration test without them.
- [ ] Confirm the plan ladder in `WORKSPACE_PLAN_LIMITS` (free/starter/growth/business + caps) or send the pricing page.
- [ ] Encryption key management for OAuth tokens: are we OK with a single env-var key (`OAUTH_TOKEN_ENCRYPTION_KEY`) for step 10, or do you want KMS from day one?

**Next**

→ **Step 3: Auth + app shell.** Email/password + magic link, `(app)` layout with the Altera sidebar + topbar, workspace picker, and the first page that actually calls `requireWorkspace()`.

---

## Step 3 — Auth + app shell ✅

**Built**

- `middleware.ts` at the repo root + `src/infrastructure/supabase/middleware.ts` helper — refreshes the Supabase SSR session on every request so Server Components never see a stale user. Matcher excludes static assets and the public `/embed/*` route (which must stay cookie-free for CDN caching).
- `src/features/auth/application/schemas.ts` — zod schemas (`loginSchema`, `signupSchema`, `magicLinkSchema`, `emailSchema`, `passwordSchema`). Same file imported by client form validation and server actions, so there's one source of truth.
- `src/features/auth/application/actions.ts` — four server actions + a helper:
  - `loginWithPassword` — zod-validates, calls `signInWithPassword`, redirects to `/dashboard`. Generic "email or password is incorrect" on failure (no user enumeration).
  - `signupWithPassword` — creates the auth user, then bootstraps the workspace + `workspace_members` row via the **service role** client (users have no INSERT policy on `workspaces` by design). If session returned → `/dashboard`; if email confirmation is enabled → `/signup/verify`.
  - `sendMagicLink` — `signInWithOtp`, redirect to `/login/sent`.
  - `logoutAction` — `signOut()` + redirect to `/login`.
  - `slugify(input)` — NFKD-normalized, diacritic-stripped, punctuation-collapsed, random 6-char suffix, capped at 50 chars to satisfy the `workspaces.slug` regex constraint.
  - All actions return a typed `ActionError` on failure and convert zod issues into per-field errors.
- `src/features/auth/ui/LoginForm.tsx` + `SignupForm.tsx` + `AuthForm.module.scss` — React 19 `useActionState` clients. Per-field error highlighting, loading state wired to the `Button`'s `loading` prop, autocomplete hints for password managers.
- `src/shared/components/TextField/*` — the Altera-styled input used by every form. Inset track, accent focus ring, error variant with red border + red ring, accessible `aria-invalid`/`aria-describedby`.
- **Auth route group** (`app/(auth)/`):
  - `layout.tsx` + `layout.module.scss` — two-column split: left brand panel with animated glow + founder testimonial, right form panel. Collapses to single column below 900px.
  - `login/page.tsx`, `signup/page.tsx`, `login/sent/page.tsx`, `signup/verify/page.tsx`.
- `app/auth/callback/route.ts` — PKCE / magic-link callback. Exchanges `?code` for a session cookie, redirects to `?next` (default `/dashboard`). On error, bounces back to `/login?error=...` with the message URL-encoded.
- **Altera app shell** (`src/shared/layout/`):
  - `Sidebar/Sidebar.tsx` + `.module.scss` — sticky left rail with logo mark, workspace card (initial + name + plan), primary nav (Dashboard / Forms / Leads / Attribution), secondary nav (Integrations / Settings). Inline SVG icons, active state with inset border + accent glow. `usePathname()` drives selection.
  - `Topbar/Topbar.tsx` + `.module.scss` — pill-shaped search with ⌘K hint, notification bell with dot, user avatar + email, logout button. Server component; logout is a form posting to `logoutAction`.
- `app/(app)/layout.tsx` + `layout.module.scss` — the gated shell. Calls `requireWorkspaceOrRedirect()` once per request. CSS grid: `sidebar | topbar / sidebar | content`. Any `(app)/*` page is guaranteed a validated `ctx` before it renders.
- `app/(app)/dashboard/page.tsx` + `page.module.scss` — first real authenticated page. Personalized greeting (`ctx.email.split("@")[0]`), workspace name with gradient highlight, hero "Leads this month" card with display-size 0 state and an "Ship your first form" sublabel, plus three empty-state cards for Top Sources / Attribution Confidence / Recent Leads. Uses the real `Button`/`Card`/`Badge` primitives — no ad-hoc styling.

**Tests passing**

- `tests/unit/auth-schemas.test.ts`:
  - `loginSchema` accepts valid, rejects short passwords, rejects malformed emails, trims whitespace.
  - `signupSchema` requires workspace name, caps at 80 chars.
  - `magicLinkSchema` only requires a valid email.
  - `slugify` produces lowercase + dash + 6-char suffix, strips diacritics via NFKD, pads short names to satisfy the 3-char slug regex, never emits leading/trailing dashes, caps length ≤ 50 so Postgres's slug check won't reject it.
- Existing step 1 + step 2 tests still green.

**Decisions (to flag to the client)**

1. **Workspace bootstrapping via the service role.** Users have zero INSERT policy on `workspaces` or `workspace_members` — they can't create workspaces through the anon client no matter what. The only path is the sanctioned signup flow, which uses the service role server-side. This means accidental client code can't create orphaned workspaces, and the audit log can reliably tie every creation to the signup action.
2. **`requireWorkspaceOrRedirect()` in the layout, not in each page.** Every page under `(app)/*` inherits the guard. No feature can forget to check auth because the layout runs first. Defense in depth on top of RLS.
3. **Magic link + password, no social auth yet.** Google/Microsoft OAuth is step 10, and we intentionally keep the surface area small until then. The callback route already handles the PKCE code exchange, so hooking OAuth in later is a one-line change on the Supabase side.
4. **Generic "email or password incorrect" error** instead of distinguishing "no such user" from "wrong password" — prevents user enumeration. Same reason we don't reveal whether an email is registered on the magic-link flow.
5. **Deferred: WorkspaceSwitcher.** Most MVP users will have exactly one workspace (the one signup created). The switcher becomes a step 3.5 task when we also add the team-invite flow. Until then, `requireWorkspace` reads the single workspace_members row.
6. **No WorkspaceSwitcher yet, no team-invite flow yet, no mobile nav drawer yet.** These are step 3.5 items that don't block any later step and aren't on the client's 13-step ladder.
7. **Altera aesthetic refined.** The auth brand panel uses a 620px radial glow behind a founder testimonial; the sidebar workspace card uses a linear-gradient logo + glow-border active state. Not generic — these are the moments that prove we're not shipping a shadcn skin.

**Open questions / awaiting client**

- [ ] Confirm we want `emailRedirectTo = ${siteUrl}/auth/callback` — this needs to be whitelisted in Supabase Auth → URL Configuration once the project exists.
- [ ] Team invite flow: invite-by-email + role dropdown? Or company-domain auto-join? Needed for step 3.5 + step 13 (audit log of role changes).
- [ ] Should the "Copy embed snippet" button on the dashboard be visible before a form exists, or hidden until the first form is created?

**Next**

→ **Step 4: Form data model completion.** Field validation schemas, theme system, `forms.service.ts` CRUD wrapped in `requireWorkspace`, and the first end-to-end "create form → list forms" flow wired to Supabase.

---

## Step 4 — Form data model ✅

**Built**

- `src/domain/form/theme.ts` — `formThemeSchema` (hex accent + 3-font + 3-corners), `DEFAULT_THEME` frozen constant, and `parseTheme()` that soft-fails back to the default on any malformed jsonb. Themes are validated on every read so a corrupted column can't crash the dashboard.
- `src/domain/form/validation.ts` — zod schemas for everything the builder and service care about:
  - `fieldTypeSchema` — the ten field types, matched exactly to the Postgres CHECK constraint.
  - `OPTIONED_FIELD_TYPES` — the three types (`dropdown`, `radio`, `checkbox`) that require a non-empty `options` array. Enforced in a `.superRefine` so zod errors surface on the `options` path.
  - `formFieldInputSchema` — label/placeholder/helpText bounds, `stepIndex`/`displayOrder` non-negative integers, options capped at 50.
  - `formCreateSchema` / `formUpdateSchema` — title 1-120 chars, optional slug matching the `forms.slug` regex from migration 0002, optional theme, optional fields array capped at 100.
  - `titleToSlug(title)` — deterministic title → slug (NFKD, diacritic-strip, collapse non-alphanumerics, cap 60, fallback `"form"` on empty). Distinct from `auth.slugify` which adds randomness for uniqueness — form slugs must be stable because they appear in the embed URL.
- `src/features/forms/application/forms.service.ts` — the forms feature service. Every function calls `requireWorkspace()` (defense in depth), goes through the user-scoped Supabase client so RLS enforces tenancy, and maps `Tables<"forms">` rows into `FormSummary`/`FormDetail` DTOs:
  - `listForms()` — workspace-scoped, sorted newest first, includes `fieldCount` via the `form_fields(count)` PostgREST aggregate.
  - `getForm(id)` — throws `FormNotFoundError` on miss (so the page can call `notFound()`), runs through RLS so cross-tenant reads return `null` the same as non-existent rows.
  - `createForm(input)` — zod-parses the input, resolves a collision-free slug via `resolveUniqueSlug(base)` (`get-a-quote`, `get-a-quote-2`, …), inserts the form row + any initial fields in a single workspace-scoped write. Detects the Postgres unique-violation code `23505` on a race and throws `SlugConflictError`.
  - `updateForm(id, patch)` — conditional partial update (only the fields actually provided are written), maps camelCase → snake_case for the DB layer.
  - `deleteForm(id)` — uses `delete({ count: "exact" })` so we can distinguish "deleted" from "already gone" and throw `FormNotFoundError` on the latter.
  - `toFormDetail(row)` — the one place that knows about column names. Everything else reads the DTO.
- `src/features/forms/application/actions.ts` — two server actions:
  - `createFormAction(prev, formData)` — zod-catches field errors onto per-field state, catches `SlugConflictError` and pins the error to the `slug` field, redirects to `/forms/{id}` on success, `revalidatePath("/forms")`.
  - `deleteFormAction(formData)` — idempotent (catches `FormNotFoundError` silently), revalidates `/forms`, redirects to the list.
- `src/features/forms/ui/NewFormForm.tsx` + `.module.scss` — React 19 `useActionState` client. Auto-focused title, optional slug with hint, per-field errors, loading-wired submit button.
- **Pages** (`app/(app)/forms/`):
  - `page.tsx` + `page.module.scss` — forms list. Empty-state card with the "your first form is a couple of clicks away" CTA. Populated state renders a responsive grid of `Card`s with title, status badge (tone derived from status), field count, relative-time "Updated" stamp, and a mono-type slug pill. Hover lifts the card and tints the border with the accent.
  - `new/page.tsx` + `page.module.scss` — create form screen with breadcrumb back to `/forms`, copywriter headline, and the `NewFormForm` client.
  - `[id]/page.tsx` + `page.module.scss` — form detail stub. Breadcrumb, title, status badge, slug pill, Edit (disabled — "Step 5") + Delete (form posting to `deleteFormAction`). Empty-state card explaining that Step 5 will wire up the field builder. Proves the full create → list → detail loop through RLS.
- `src/types/database.ts` — exported `Json` type (was previously file-local) so service code can cast safely through `as unknown as Json` when writing theme/options jsonb columns.

**Tests passing**

- `tests/unit/form-validation.test.ts`:
  - `formThemeSchema` accepts the default, rejects non-hex accents, rejects 3-digit shorthand, rejects unknown fonts.
  - `parseTheme()` returns valid themes verbatim and falls back to `DEFAULT_THEME` for `null`, malformed objects, and wrong types.
  - `formFieldInputSchema` accepts basic short_text, requires options on dropdown + radio, accepts optioned fields when populated, rejects empty (whitespace-only) labels.
  - `formCreateSchema` accepts title-only, trims titles, rejects slugs with spaces, accepts 100 fields, rejects 101.
  - `titleToSlug()` lowercases + dashes punctuation, strips diacritics via NFKD, collapses non-alphanumeric runs, falls back to `"form"` for empty/whitespace input, caps at 60 chars.
- Existing step 1-3 tests still green.

**Decisions (to flag to the client)**

1. **Deterministic slug + numeric suffix on collision.** Slugs appear in embed URLs, so stability matters — we can't add randomness like auth.slugify does. `resolveUniqueSlug()` lists existing slugs in the workspace and finds the first free `base-N` suffix, with a hard ceiling of 1000 before we give up.
2. **All form writes go through RLS, not the service role.** Signup is the only place in the whole codebase that uses the service role for a tenant table. Everything else — creating forms, fields, versions, leads, etc — runs through the user's Supabase client so RLS is the backstop, not an afterthought.
3. **Theme parsing is soft-fail.** If the `forms.theme` column ever contains garbage (bad migration, manual edit), the dashboard falls back to `DEFAULT_THEME` instead of 500'ing. Malformed themes are a soft problem, not a hard one.
4. **Members can create and delete forms.** We loosened the `requireWorkspace({ minRole: "admin" })` check to just `requireWorkspace()`. For MVP the "member" role is the default, and members expect to build forms. Role-gated restrictions (e.g. publish, delete) can land in step 13 if you want them.
5. **Field builder is step 5, not 4.** Step 4 ships the form row + everything needed to create + list + detail. The field-builder UI with drag & drop, logic, and multi-step handling is a dedicated step because it's the product's hardest UX problem.
6. **`form_fields(count)` via PostgREST aggregate** so the list page gets field counts without an N+1. If this ever becomes a bottleneck we'll materialize it on the `forms` row.

**Open questions / awaiting client**

- [ ] Should form deletion be a soft delete (`status = 'archived'`) or a hard delete? Right now it's hard delete. Archived forms would let us keep `leads` dangling for historical attribution reports.
- [ ] Title length limit: 120 chars feels right for internal-facing names but is there a brand reason to bump it?
- [ ] Confirm we want members (default role) to be able to delete forms, or should that be admin-gated?

**Next**

→ **Step 5: Form builder Design tab + 8 templates.** Drag-and-drop field editor, per-field settings panel, live preview, and a starter-template gallery (contact / consultation / quote / newsletter / booking / feedback / rsvp / waitlist).

---

## Step 5 — Form builder + templates ✅

**Built**

- `src/domain/form/templates.ts` — the eight starter templates as pure data objects (`contact`, `consultation`, `quote`, `newsletter`, `booking`, `feedback`, `rsvp`, `waitlist`). Each template carries a default form title, a `FormThemeInput`, a typed `FormFieldInput[]` with stable `displayOrder`, and a submit-button + success-message copy pair. A `field(i, overrides)` helper inside the module defaults `stepIndex: 0` + `displayOrder: i` so the authoring surface stays free of boilerplate. `getTemplate(key)` throws on miss so callers don't have to null-check.
- `src/features/forms/application/fields.service.ts` — server-scoped CRUD for `form_fields`:
  - `FormFieldDTO` is the camelCase shape everything above the service consumes. `toFieldDTO(row)` is the one place that knows about the snake_case columns, and it defensively filters `options` down to the strings (jsonb can technically hold anything).
  - `assertFormBelongsToWorkspace(formId, workspaceId)` — explicit guard on top of RLS so the builder gets a clean `FormNotFoundError` instead of a Postgres 42501.
  - `listFields(formId)` — ordered by `step_index` then `display_order`.
  - `addField(formId, input)` — when `displayOrder === 0` it looks up the last order in the same step and appends at the end, so palette taps always land at the bottom of the current step.
  - `updateField(fieldId, patch)` — conditional spread, only sends snake_case columns for the props actually present in the patch.
  - `deleteField(fieldId)` — workspace-scoped delete.
  - `reorderFields(formId, orderedIds)` — takes the full ordered id list and writes `display_order = i` back for each id. Dumber than a pair-swap but atomic from the user's perspective: we never leave the builder in a half-reordered state.
  - `applyTemplateFields(formId, fields)` — bulk inserts and **refuses** if the form already has any fields, so "apply template" can never clobber user work with no undo.
- `src/features/forms/application/field.actions.ts` — typed `ActionResult<T>` discriminated union (`{ ok: true; data } | { ok: false; error }`) so the client can merge authoritative rows back into state without a redirect:
  - `addFieldAction`, `updateFieldAction`, `deleteFieldAction`, `reorderFieldsAction`, `applyTemplateAction`.
  - `applyTemplateAction` also pushes the template's `theme`, `submitButtonLabel`, and `successMessage` onto the form row via `updateForm` before inserting fields.
- `src/features/forms/application/actions.ts` — added `createFormFromTemplateAction(prev, formData)` that accepts a `templateKey`, seeds a new form with the template's title + theme + copy + fields via the existing `createForm` service in one call, and redirects to the builder. An empty `templateKey` falls through to a blank `"Untitled form"` so the gallery's "Start from scratch" card can use the same action.
- **Form builder UI** (`src/features/forms/ui/FormBuilder/`):
  - `FormBuilder.tsx` — client shell with a 3-column grid (palette / preview / editor). Holds the authoritative `fields` array in `useState`, uses `useTransition` for pending state, and implements **optimistic updates with temp ids**: on add we generate `temp-${crypto.randomUUID()}` so the preview updates instantly, then swap in the server row on success or roll back on failure. `handleUpdate` / `handleDelete` / `handleReorder` all short-circuit their server calls when the target field is still a temp row (it hasn't landed yet). Errors surface as a bottom-right toast so the builder stays interactive.
  - `FieldPalette.tsx` + `.module.scss` — left column, 10 field types with mono icon + label + hint. Clicking a row calls `onAdd(type)`, which appends a new field to the preview.
  - `LivePreview.tsx` + `.module.scss` — middle column, renders each field as a disabled native control (input / textarea / select / radios / checkboxes / date / file drop) inside a draggable row. **HTML5 native drag-and-drop** — no react-dnd dependency, just `dragstart` / `dragover` / `drop` with a `dataTransfer` payload. The row also handles keyboard selection (click/Enter/Space) and an inline delete button.
  - `FieldEditor.tsx` + `.module.scss` — right column, sticky. Uses **local draft state** for label / placeholder / help text / options with a `useEffect` that resyncs when the selected field changes. onBlur commits to the parent (and therefore to the server) — so every keystroke doesn't fire a server action, but the required toggle commits immediately because it's atomic. The options textarea is only rendered when `OPTIONED_FIELD_TYPES.has(field.type)`.
  - `FormBuilder.module.scss` — 260 / 1fr / 320 grid collapsing to 220 / 1fr and then to a single column below 900px.
- **Template gallery** (`src/features/forms/ui/TemplateGallery.tsx` + `.module.scss`) — grid of starter cards rendered on `/forms/new`. Each card is a submit button posting a `templateKey` to `createFormFromTemplateAction`, with a "Start from scratch" card using an empty key. Cards show the template badge, title, blurb, field count, and a pending state while the action is in flight.
- **Pages wired**:
  - `app/(app)/forms/new/page.tsx` — now renders `<TemplateGallery />` as the primary path, with `<NewFormForm />` kept below as the "or name it yourself" fallback for users who want full control over title + slug.
  - `app/(app)/forms/[id]/page.tsx` — fetches both `getForm(id)` and `listFields(id)` in parallel and mounts `<FormBuilder>` inline. The Edit (Step 5) stub has been replaced by a Publish (Step 6) stub. The header now shows a live field count next to the slug.
- `vitest.config.ts` — added a `server-only` alias pointing at `tests/stubs/server-only.ts` (an empty module) so service files marked `import "server-only"` can be imported by unit tests without the Next runtime. This lets `toFieldDTO` be covered directly.

**Tests passing**

- `tests/unit/form-templates.test.ts`:
  - Asserts the eight templates are in the documented stable order and have unique keys.
  - Every template round-trips through `formCreateSchema.safeParse` as a whole (title + theme + submit copy + fields).
  - Every template's theme passes `formThemeSchema` independently.
  - Every template field passes `formFieldInputSchema` independently (catches the classic "forgot options on a dropdown" bug before a user ever clicks).
  - Every optioned field (`dropdown` / `radio` / `checkbox`) ships with a non-empty `options` array.
  - `displayOrder` is monotonic within each template.
  - `submitButtonLabel`, `successMessage`, `defaultFormTitle`, and `badge` are all non-empty.
  - `getTemplate` returns the right template for a known key and throws for unknown keys.
  - `toFieldDTO` maps snake_case rows to camelCase DTOs, filters non-string entries out of `options` defensively, and returns `[]` when `options` isn't an array.
- All step 1-4 tests still green.

**Decisions (to flag to the client)**

1. **HTML5 native drag-and-drop instead of react-dnd.** The whole drag logic is about 40 lines and lives in one file; pulling in react-dnd (and its context provider, and its backend, and its ESM interop quirks) would more than double the surface area for no functional gain. If we later need cross-window drops or touch DnD, we can swap in `@dnd-kit/core` — its API is close enough that the diff will be surgical.
2. **Optimistic updates with temp ids.** Field adds update the preview instantly using a `temp-${uuid}` id, then swap in the authoritative row on success or roll back on failure. Updates and reorders that target a temp row skip the server call entirely until the temp lands. The outcome: the builder feels local-first even on a slow connection, and we never fire mutations against ids the server hasn't acknowledged.
3. **`onBlur` commits in FieldEditor, immediate commits for toggles.** Every keystroke would hammer the server action and cause wasted revalidations; committing on blur batches edits into one write per field. The required toggle is atomic and commits instantly because there's no "draft" state to collect.
4. **`applyTemplateFields` refuses on non-empty forms.** Applying a template on top of existing work would silently wipe the user's fields with no undo. The service returns an error instead; `applyTemplateAction` surfaces it. Template application is therefore strictly a first-action operation — which is exactly what the gallery triggers, so there's no UX regression.
5. **`reorderFields` is a dumb loop, not a pair-swap.** Pair-swapping optimizes the DB write count but leaves intermediate states observable under concurrent reads. A single ordered write-through is slower but atomic from the user's perspective, and the builder's field counts are small enough that the cost is negligible.
6. **`createFormFromTemplateAction` reuses the existing `createForm` service.** One code path for form creation means one place for slug collision handling, audit logging, and zod validation — the template flow is just a different input shape.
7. **Template theme + submit copy are applied alongside fields.** When the user picks "Quote", they get the amber accent, the "Get my quote" submit label, and the "We'll review and send a written quote within 48 hours" success message — not just the field list. Templates are meant to be opinionated first drafts, not bare skeletons.
8. **`server-only` vitest alias instead of extracting `toFieldDTO` to a standalone module.** Keeps the mapping next to its DTO and the columns it reads — moving it out would create a phantom module for the sake of one unit test. The alias stub is a four-line file and only applies under test.

**Open questions / awaiting client**

- [ ] Conditional logic ("show field X only if Y = Z") is out of scope for step 5. Confirm we want it as step 5.5 or deferred to a later phase?
- [ ] Multi-step forms: the schema already supports `step_index`, but the builder only exposes step 0. Should step 5.5 add the step switcher, or wait?
- [ ] Template copy: the current `successMessage` text is mine — want to route those through your copywriter before step 7 (the embed script) ships?
- [ ] Should the per-field help text support markdown (bold / link), or is plain text enough for MVP?

**Next**

→ **Step 6: Publish + form versions.** Publish toggle writes a `form_versions` snapshot, unpublished forms 404 on the embed route, and the dashboard surfaces version history.

---

## Step 6 — Publish + form versions

**Done**

- `src/domain/form/snapshot.ts` — pure `buildSnapshot()` that pins `schemaVersion: 1`, sorts fields deterministically by `(stepIndex, displayOrder)`, and never mutates input arrays.
- `src/features/forms/application/publish.service.ts` — `publishForm()`, `unpublishForm()`, `listVersions()`, `getPublishedSnapshot()` (admin client, used by embed), `loadFormForSubmission()`. Next version computed as `max(version) + 1`, with the unique `(form_id, version)` constraint as a backstop for concurrent publishes.
- `publish.actions.ts` — `publishFormAction` / `unpublishFormAction` returning `{ ok, error?, version? }`. `CannotPublishEmptyFormError` + `FormNotPublishedError` surface cleanly in the UI.
- `PublishControl.tsx` + `.module.scss` — dual `useActionState` hooks, green version badge on the published state.
- `app/(app)/forms/[id]/page.tsx` — loads form + fields + versions in parallel, mounts the builder and publish control inline.
- `tests/unit/form-snapshot.test.ts` — 4 tests: schemaVersion pinning, deterministic sort, structural equality via `JSON.stringify`, input-array non-mutation.

**Decisions**

1. **Snapshots are full JSON blobs, not diffs.** Every published version stores a complete shape so the embed script reads from an immutable record that can't be broken by subsequent draft edits. Disk is cheap; surprise breakage is not.
2. **Deterministic field sort before snapshot.** Sorting by `(stepIndex, displayOrder)` at snapshot time gives us clean `JSON.stringify` diffs between versions, which we'll exploit in step 6.5 if the client asks for a version-diff viewer.
3. **Empty forms refuse to publish.** `CannotPublishEmptyFormError` means the embed script never has to deal with a zero-field snapshot — a whole class of rendering edge cases disappears.
4. **Unique `(form_id, version)` constraint is our race guard.** If two tabs hit "Publish" at once, one succeeds and the other gets a clean error the UI can retry.

---

## Step 7 — Embed script + embed route

**Done**

- `embed/src/index.ts` — ~350 line IIFE. Reads `data-ft-workspace`, `data-ft-form`, `data-ft-target` from the script tag; captures UTMs + referrer + click IDs into `sessionStorage` under `__formtrack_attribution__` so SPA navigations don't wipe the original source; fetches the snapshot from `/api/embed/{workspace}/{form}`; renders vanilla DOM with `ft-` class prefix; submits to `/api/submissions/{workspace}/{form}`. Zero runtime deps.
- `app/api/embed/[workspace]/[form]/route.ts` — GET returns published snapshot JSON with wide-open CORS + 60s cache. OPTIONS handler for preflight. 404 on `FormNotPublishedError`.
- `app/embed/[workspace]/[form]/page.tsx` + `EmbedRuntime.tsx` — hosted-page fallback. `generateMetadata` returns `robots: { index: false }`. Mounts a React client runtime that mirrors the vanilla script's logic so embed-preview in-app matches what external sites see.

**Decisions**

1. **Vanilla IIFE, not a React bundle, for the public embed.** The widget has to work on WordPress, Webflow, Squarespace, Wix, raw HTML — places where shipping React means pulling in >50 KB. The vanilla script is <10 KB gzipped and has zero interop issues.
2. **`sessionStorage` attribution caching.** UTMs get captured on first pageview and replayed on submit even if the user navigates around the site. Sites that strip UTMs cross-page (everyone's) get real attribution anyway.
3. **Embed route is admin-client, RLS-bypass.** The whole point of publishing is "anyone on the internet can read this snapshot." RLS would just block us here; we rely on `status = 'published'` + `form_versions` being the only thing the route exposes.
4. **Hosted `/embed/{w}/{f}` page as a fallback.** Some platforms (Notion, for instance) can't run inline scripts but can embed an iframe. The hosted page is that iframe target.
5. **60-second cache on the snapshot route.** A form gets republished maybe a few times a day; 60s is long enough to absorb a traffic spike and short enough that fixes propagate fast.

---

## Step 8 — Submissions API + attribution resolution

**Done**

- `src/features/submissions/application/submit.service.ts` — `submitLead(snapshot, input, ctx)` validates + inserts. Hashes IPs with SHA-256 + `FORMTRACK_IP_PEPPER` so raw IPs never hit disk. Promotes first email/phone/name fields into typed columns so the dashboard doesn't have to reach into `values` jsonb.
- `validateAgainstSnapshot()` + `SubmissionValidationError` — per-field: required check, email format, number coercion, dropdown/radio/checkbox value whitelist against `options`.
- `src/features/submissions/application/rateLimit.ts` — in-memory token bucket: 10 req / 10 s burst + 60 req / hr steady. Returns `{ ok, retryAfterMs, reason }`. `__resetRateLimits()` exported for tests.
- `app/api/submissions/[workspaceId]/[formId]/route.ts` — POST with rate-limit by `${ip}:${formId}`, admin-client snapshot load (falls back to live field rebuild if no version row yet), `submitLead` call, then `queueAutoReply(...).catch(console.error)` fire-and-forget. 422 with `fieldErrors` on validation, 404 on unpublished, 429 with `Retry-After` on limit.
- `src/features/autoReply/application/autoReply.service.ts` — MVP audit-log placeholder for sends (upgraded to real API calls in step 11).
- `tests/unit/submission-validation.test.ts` — 7 validator cases + 3 `renderTemplate` template-replacement cases.

**Decisions**

1. **IP pepper + SHA-256, not plain IPs.** We need rate limiting and abuse detection but don't want a PII liability. Hashed IPs still dedupe but can't be reversed without the server-held pepper.
2. **In-memory token bucket over a Redis dependency.** Good enough for single-region MVP; swap to an Upstash / Durable Object store when we go multi-region. The interface (`checkRateLimit(key)`) is stable across both.
3. **Fallback snapshot rebuild in the submission route.** If a form_versions row is missing (half-baked publish, hand-edited state), the route rebuilds a snapshot from `form_fields` on the fly rather than 500ing. Keeps the public path resilient.
4. **Contact field promotion in `submit.service.ts`.** First email, first phone, first short_text labelled "name" land in typed columns. The dashboard renders them without a single jsonb lookup; search works with plain `ilike`.
5. **Auto-reply is fire-and-forget.** `queueAutoReply(...).catch(console.error)` means a dead integration token or a 5xx from Gmail never blocks the visitor's 200 response.

---

## Step 9 — Leads dashboard + attribution reports

**Done**

- `src/features/leads/application/leads.service.ts` — `listLeads(filters)` with search/channel/formId + pagination via `.range()`; `getLead(id)` throws `LeadNotFoundError`; `getAttributionBreakdown({ sinceIso, formId })` returns `{ rows, total, confidenceTotals }` aggregated by `source_channel`.
- `app/(app)/leads/page.tsx` — server component with `searchParams` for `q` + `channel`, filtered table, empty state linking to `/forms`.
- `app/(app)/leads/[id]/page.tsx` — four cards: "Why we attributed this" (explanation + campaign + referrer + confidence), "Contact" (mailto link), "Submission" (values dl), "Raw attribution" (JSON pre).
- `app/(app)/attribution/page.tsx` — 30-day report with 4 summary cards (total, high/med/low) + stacked-bar chart by source channel with confidence breakdown.

**Decisions**

1. **"Why we attributed this" is first-class UI, not a footer.** The whole pitch of FormTrack is attribution transparency — the explanation belongs above the fold, not hidden in raw JSON.
2. **Confidence bands (high/medium/low), not a single score.** Business owners don't need a 0–100 number; they need "I can trust this one" vs "the agency made it up." Three buckets mirror how we compute it anyway.
3. **30-day default window on `/attribution`.** Matches how most agencies report; easy to extend to a custom range later without changing the service signature (it already takes `sinceIso`).
4. **Empty state links to `/forms`, not to docs.** The right answer to "no leads" is "publish a form," not "read more about attribution."

---

## Step 10 — Integrations (OAuth Google + Microsoft)

**Done**

- `src/features/integrations/application/tokens.ts` — AES-256-GCM token encryption with scrypt-derived key from `OAUTH_TOKEN_ENCRYPTION_KEY`; HMAC-SHA256 signed OAuth state (`signOAuthState` / `verifyOAuthState`) with `timingSafeEqual` comparison.
- `integrations.service.ts` — RLS-scoped `listIntegrations()` + `listInboxes()`; admin-client `upsertIntegrationTokens()` (encrypts before insert) + `disconnectIntegration()` + `getDecryptedIntegration()` (server-side decrypt for outbound sends).
- `app/api/oauth/google/connect/route.ts` + `.../callback/route.ts` — authorization code flow with Gmail `gmail.send` scope; exchanges code → tokens, fetches userinfo for `account_email`, writes encrypted tokens, audit-logs the connection.
- `app/api/oauth/microsoft/connect/route.ts` + `.../callback/route.ts` — Graph `Mail.Send` + `offline_access` scopes; Graph `/me` for display email.
- `app/(app)/integrations/page.tsx` + `DisconnectButton.tsx` + `page.module.scss` — card per provider showing connected state, account email, scopes, disconnect button.
- `src/features/audit/application/audit.service.ts` — `writeAuditLog()` + `listAuditLog()`. Note the schema uses `actor_user_id` / `resource_type` / `resource_id`; the service presents a nicer `userId` / `entityType` / `entityId` API on top.

**Decisions**

1. **Server-held encryption key, not per-user.** Tokens live at the workspace level (so a workspace outlives any admin who connected an inbox), which means we can't key on user identity. The server-held `OAUTH_TOKEN_ENCRYPTION_KEY` + fixed salt pepper is the tradeoff; stolen DB without stolen env var = unreadable tokens.
2. **AES-256-GCM over AES-CBC.** GCM gives us AEAD (integrity + authenticity) in one pass; CBC would need a separate HMAC and we'd almost certainly screw up the order of operations.
3. **HMAC-signed OAuth state, not just a random nonce in a cookie.** Cookie-based state breaks when OAuth bounces through third-party domains with strict SameSite; signing the state token lets us verify workspace ownership without any session lookup.
4. **`gmail.send` scope only — never `gmail.readonly`.** The whole product promise is "we send, we don't read." Asking for read scopes would make the consent screen scary and buy us nothing.
5. **`offline_access` on Microsoft.** We need refresh tokens to keep sending auto-replies after the initial hour-long access token expires; Google returns refresh tokens by default with `access_type=offline&prompt=consent`.
6. **Admin client for writes, RLS client for reads.** Reads go through the user's RLS scope as a belt-and-suspenders guard; writes need the admin client because encryption + status updates happen in places (OAuth callbacks, webhook handlers) that run outside an authenticated request.

---

## Step 11 — Auto-reply + real email routing

**Done**

- `src/infrastructure/email/send.ts` — `sendEmail()` adapter that dispatches to `sendViaGmail` (RFC 5322 → base64url → Gmail API) or `sendViaGraph` (Graph `/me/sendMail` JSON). Centralizes RFC 5322 header building, UTF-8 subject encoding, and error shape.
- `autoReply.service.ts` — rewritten: loads the form + lead + decrypted integration, renders the template with `{{name}}`, `{{email}}`, `{{form}}` vars, calls `sendEmail`, audit-logs `auto_reply.sent` / `.failed` / `.skipped` with provider message id + error, marks the integration `status = 'error'` on failed sends so the /integrations page can surface "needs reauth" without a polling job.
- `src/features/forms/ui/AutoReplySettings.tsx` + `.module.scss` — enable toggle, inbox selector (populated from `listInboxes()`), textarea for the message with the default template, inline save feedback. Gated on whether the workspace has any connected inbox.
- `autoReply.actions.ts` — `updateAutoReplyAction` with validation (can't enable without an inbox + message) and revalidation.
- `app/(app)/forms/[id]/settings/page.tsx` — server page that loads form + inboxes and mounts `AutoReplySettings` inside a card, with breadcrumbs back to the builder.

**Decisions**

1. **No Nodemailer, no @sendgrid/mail, no stripe SDK — raw `fetch` to each provider.** One less dependency per integration, no ESM interop headaches on Next 16, and the API surface we actually use is ~30 lines per provider. Trade-off: we do our own RFC 5322 builder (small, well-tested) and Stripe signature verification (see step 12).
2. **Plain-text bodies only for MVP.** Personal-feeling replies beat branded HTML emails every time, and we dodge inlining CSS for Outlook. Escalate to MJML if the client insists.
3. **Mark integration `status = 'error'` on send failure.** Gives us "self-healing" on expired refresh tokens: the /integrations page can show a reconnect prompt without us writing a background worker.
4. **Template vars are flat, not nested.** `{{name}}` / `{{email}}` / `{{form}}` is enough; nested paths invite injection cuteness and the test matrix gets ugly.
5. **Auto-reply settings live on `/forms/[id]/settings`, not inside the builder tab.** Keeps the builder focused on field editing; settings are separate so the builder stays performant and the settings form can submit independently.

---

## Step 12 — Stripe billing + plan gates

**Done**

- `src/features/billing/application/plans.ts` — catalog of free / starter / growth / business with `PlanLimits` (`maxForms`, `maxSubmissionsPerMonth`, `maxInboxes`, `maxTeamMembers`, `customDomain`), price IDs resolved from env vars (`STRIPE_PRICE_STARTER` etc.), `planFromStripePriceId()` reverse map used by the webhook.
- `src/features/billing/application/gates.ts` — `assertCanCreateForm()`, `assertCanConnectInbox()`, `assertCanInviteMember()`. Each throws `PlanLimitError` with a human message the UI can render inline with an upgrade link.
- `forms.service.ts` `createForm()` now calls `assertCanCreateForm()` before taking the slug.
- `src/infrastructure/stripe/client.ts` — tiny raw-fetch Stripe client: `createCheckoutSession`, `createBillingPortalSession`, `verifyStripeSignature` (HMAC-SHA256 with 5-minute tolerance, `timingSafeEqual` comparison). No `stripe` npm package — we use maybe 3 endpoints.
- `app/api/billing/checkout/route.ts` + `portal/route.ts` + `webhook/route.ts` — webhook handles `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, flips `workspaces.plan` accordingly.
- `app/(app)/settings/billing/page.tsx` + `PlanButtons.tsx` + `.module.scss` — four-plan grid with current badge, inline fetch call to `/api/billing/checkout` that redirects on success, "Manage subscription" button that opens the Stripe billing portal.

**Decisions**

1. **No `stripe` SDK.** Saves ~400 KB on the server bundle and sidesteps the ESM/CJS dance Next has with certain Stripe versions. Our signature verifier is 15 lines and covered by unit tests (to add in step 12.5 if needed).
2. **Plan catalog in code, not in the database.** Limits + features change with marketing copy, not with customer data. Keeping them in `plans.ts` means a plan change is a code review, not an ops ticket.
3. **Stripe price IDs via env vars keyed by plan.** Test Stripe account + live Stripe account can both work with the same deploy — just set `STRIPE_PRICE_STARTER` differently per environment.
4. **Gates throw `PlanLimitError`, don't return booleans.** Callers can't accidentally forget to check. Actions catch the specific type and set `upgradeRequired: true` so the UI can render "Upgrade" inline.
5. **Checkout metadata stores `workspace_id` on both the session AND the subscription.** Stripe doesn't copy session metadata onto the subscription automatically, so the webhook needs it in both places to resolve which workspace to update on `subscription.updated`.
6. **Downgrades go through the Stripe billing portal.** We don't build a downgrade UI — Stripe's portal handles proration, mid-cycle changes, and cancel-at-period-end correctly out of the box.

---

## Step 13 — Team invites + audit log UI + settings layout

**Done**

- `src/features/team/application/team.service.ts` — `listMembers()` (joins emails from `auth.users` via the admin client because RLS can't see auth.users), `inviteMember()` (creates the auth user via `inviteUserByEmail` if new, upserts workspace_members row, gated on role + plan), `removeMember()`. `InsufficientPermissionError` so the UI can distinguish "not allowed" from other failures.
- `src/features/team/application/actions.ts` — `inviteMemberAction` with zod validation + `PlanLimitError` handling (returns `upgradeRequired: true`), `removeMemberAction`.
- `app/(app)/settings/team/page.tsx` + `InviteForm.tsx` + `RemoveButton.tsx` + `.module.scss` — members table with role badges, invite form visible only to owners/admins, remove button hidden for self and for owners.
- `app/(app)/settings/audit/page.tsx` + `.module.scss` — audit log viewer. Pretty-labels known action codes (`integration.connected`, `auto_reply.sent`, `billing.plan_changed`, etc.), shows raw metadata JSON below each entry.
- `app/(app)/settings/layout.tsx` + `layout.module.scss` — shared 200 px sidenav with Billing / Team / Audit log tabs, stacks on mobile.
- `app/(app)/settings/page.tsx` — redirects `/settings` to `/settings/billing` so the top-level nav can link there without picking a sub-route.

**Decisions**

1. **`inviteUserByEmail` over `generateLink`.** Supabase sends the magic link email itself, so we don't need to wire SMTP on the FormTrack side. If the user is already a Supabase auth user (common for existing customers with multiple workspaces), we skip the invite step entirely and just add them to `workspace_members`.
2. **Audit log is append-only, enforced at the DB.** The `reject_audit_log_mutation` trigger from 0005 blocks updates and deletes even for the service role. The UI doesn't have edit buttons because there's nothing to edit.
3. **Action-code → friendly-label map in the page, not the service.** The service stores canonical action strings; the UI decides how to display them. Translators / copy tweaks don't touch the data layer.
4. **Settings layout shares a sidenav, not separate top-level routes.** Billing / Team / Audit log are all workspace-scoped admin surfaces; grouping them is more discoverable than scattering them across the main nav.
5. **Remove button hidden for self and for owners.** Prevents the two most common footguns: leaving yourself outside the workspace, and orphaning ownership. Owner transfer is deferred to a future step.

**Open questions / awaiting client**

- [ ] Owner transfer UI — worth building now, or leave as "contact support"?
- [ ] Audit log retention: keep everything forever, or age out after N days?
- [ ] Invite expiry: Supabase magic links expire after 24h by default; want us to bump it?
- [ ] Row-level filter on audit log (e.g., "billing events only") — wait for the first customer to ask?

**Next**

FormTrack MVP build order complete. Next phase is QA pass + e2e tests + deploy.

---
