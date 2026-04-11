-- ─── FormTrack — Row Level Security policies ──────────────
-- This is THE migration that enforces multi-tenant isolation.
-- Every tenant-owned table:
--   1. has RLS enabled
--   2. has FORCE RLS (so even the table owner role is blocked)
--   3. has a policy per action (SELECT / INSERT / UPDATE / DELETE)
--   4. the policy matches workspace_id = public.current_workspace_id()
--
-- Test this from a real Supabase client session, not the SQL
-- editor. The SQL editor bypasses RLS.

-- ─────────────────────────────────────────────────────────────
-- workspaces
-- ─────────────────────────────────────────────────────────────
alter table public.workspaces enable row level security;
alter table public.workspaces force  row level security;

-- Users see the workspaces they're a member of (not every workspace).
create policy "workspaces: members can read"
  on public.workspaces for select
  using (
    id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid()
    )
  );

-- Only owners can update workspace-level settings.
create policy "workspaces: owners can update"
  on public.workspaces for update
  using (
    exists (
      select 1 from public.workspace_members
      where workspace_id = workspaces.id
        and user_id = auth.uid()
        and role = 'owner'
    )
  )
  with check (
    exists (
      select 1 from public.workspace_members
      where workspace_id = workspaces.id
        and user_id = auth.uid()
        and role = 'owner'
    )
  );

-- Workspace creation happens through a server-side action that
-- uses the service role. No insert policy here intentionally.
-- Workspace deletion is soft-delete via status, not a DELETE.

-- ─────────────────────────────────────────────────────────────
-- workspace_members
-- ─────────────────────────────────────────────────────────────
alter table public.workspace_members enable row level security;
alter table public.workspace_members force  row level security;

create policy "members: see own memberships"
  on public.workspace_members for select
  using (
    user_id = auth.uid()
    or workspace_id = public.current_workspace_id()
  );

create policy "members: admins can add"
  on public.workspace_members for insert
  with check (
    exists (
      select 1 from public.workspace_members m
      where m.workspace_id = workspace_members.workspace_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  );

create policy "members: admins can update roles"
  on public.workspace_members for update
  using (
    exists (
      select 1 from public.workspace_members m
      where m.workspace_id = workspace_members.workspace_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  );

create policy "members: admins can remove"
  on public.workspace_members for delete
  using (
    exists (
      select 1 from public.workspace_members m
      where m.workspace_id = workspace_members.workspace_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  );

-- ─────────────────────────────────────────────────────────────
-- forms
-- ─────────────────────────────────────────────────────────────
alter table public.forms enable row level security;
alter table public.forms force  row level security;

create policy "forms: read own workspace"
  on public.forms for select
  using (workspace_id = public.current_workspace_id());

create policy "forms: insert own workspace"
  on public.forms for insert
  with check (workspace_id = public.current_workspace_id());

create policy "forms: update own workspace"
  on public.forms for update
  using      (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());

create policy "forms: delete own workspace"
  on public.forms for delete
  using (workspace_id = public.current_workspace_id());

-- ─────────────────────────────────────────────────────────────
-- form_fields
-- ─────────────────────────────────────────────────────────────
alter table public.form_fields enable row level security;
alter table public.form_fields force  row level security;

create policy "form_fields: read own workspace"
  on public.form_fields for select
  using (workspace_id = public.current_workspace_id());

create policy "form_fields: insert own workspace"
  on public.form_fields for insert
  with check (workspace_id = public.current_workspace_id());

create policy "form_fields: update own workspace"
  on public.form_fields for update
  using      (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());

create policy "form_fields: delete own workspace"
  on public.form_fields for delete
  using (workspace_id = public.current_workspace_id());

-- ─────────────────────────────────────────────────────────────
-- form_versions (read-only from the app layer; versions are
-- written by a server action that uses the service role)
-- ─────────────────────────────────────────────────────────────
alter table public.form_versions enable row level security;
alter table public.form_versions force  row level security;

create policy "form_versions: read own workspace"
  on public.form_versions for select
  using (workspace_id = public.current_workspace_id());

-- ─────────────────────────────────────────────────────────────
-- leads
-- Inserts happen through the public submissions API using the
-- service-role client (after CAPTCHA + rate limit). The
-- dashboard client reads through the anon client, RLS-scoped.
-- ─────────────────────────────────────────────────────────────
alter table public.leads enable row level security;
alter table public.leads force  row level security;

create policy "leads: read own workspace"
  on public.leads for select
  using (workspace_id = public.current_workspace_id());

create policy "leads: update own workspace"
  on public.leads for update
  using      (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());

create policy "leads: delete own workspace"
  on public.leads for delete
  using (workspace_id = public.current_workspace_id());

-- NOTE: no INSERT policy — public submissions go through the
-- service role client in the submissions API route after
-- validating the public form slug + rate limit + CAPTCHA.

-- ─────────────────────────────────────────────────────────────
-- integrations (OAuth tokens — sensitive, admin-only read)
-- ─────────────────────────────────────────────────────────────
alter table public.integrations enable row level security;
alter table public.integrations force  row level security;

create policy "integrations: read own workspace admins"
  on public.integrations for select
  using (
    workspace_id = public.current_workspace_id()
    and exists (
      select 1 from public.workspace_members m
      where m.workspace_id = integrations.workspace_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  );

-- Writes always go through the server-side OAuth handlers
-- using the service role client so tokens can be encrypted
-- before they land. No insert/update/delete policies here.

-- ─────────────────────────────────────────────────────────────
-- audit_log (admin-only read)
-- ─────────────────────────────────────────────────────────────
alter table public.audit_log enable row level security;
alter table public.audit_log force  row level security;

create policy "audit_log: owners can read"
  on public.audit_log for select
  using (
    workspace_id = public.current_workspace_id()
    and exists (
      select 1 from public.workspace_members m
      where m.workspace_id = audit_log.workspace_id
        and m.user_id = auth.uid()
        and m.role = 'owner'
    )
  );

-- No write policies: audit log is always written via service role.
