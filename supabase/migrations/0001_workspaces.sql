-- ─── FormTrack — Workspaces + Members + JWT claim ──────────
-- Every tenant-owned row in FormTrack is scoped to a workspace.
-- This migration creates the tenant boundary and the helper
-- function that all RLS policies reference.
--
-- Multi-tenancy strategy:
--   1. Every tenant-owned table has a `workspace_id uuid not null` column.
--   2. A Supabase custom access token hook writes the user's active
--      workspace_id into the JWT `app_metadata`.
--   3. `public.current_workspace_id()` reads that claim.
--   4. Every policy matches `workspace_id = public.current_workspace_id()`.

-- ─── Extensions ──────────────────────────────────────────────
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- ─── Workspaces (the tenant) ─────────────────────────────────
create table public.workspaces (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null check (char_length(name) between 1 and 80),
  slug               text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$'),
  plan               text not null default 'free'
                     check (plan in ('free', 'starter', 'growth', 'business')),
  stripe_customer_id text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.workspaces is
  'Tenant boundary. Every tenant-owned row has a workspace_id FK into this table.';

-- ─── Workspace members (user ↔ workspace join) ───────────────
create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null references auth.users(id)        on delete cascade,
  role         text not null default 'member'
               check (role in ('owner', 'admin', 'member')),
  joined_at    timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index workspace_members_user_idx
  on public.workspace_members (user_id);

comment on table public.workspace_members is
  'Which users belong to which workspace and what role they play.';

-- ─── Helper: current workspace from JWT ─────────────────────
-- This is the single source of truth every RLS policy calls.
-- Reads the workspace_id set by the custom access token hook
-- (preferred), falling back to top-level claim for test fixtures.
create or replace function public.current_workspace_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    nullif(auth.jwt() #>> '{app_metadata,workspace_id}', '')::uuid,
    nullif(auth.jwt() ->> 'workspace_id', '')::uuid
  );
$$;

comment on function public.current_workspace_id() is
  'Returns the active workspace_id from the authenticated user''s JWT claims. Used by every RLS policy.';

revoke execute on function public.current_workspace_id() from public;
grant  execute on function public.current_workspace_id() to authenticated, anon;

-- ─── Helper: is the caller a member of this workspace? ─────
-- Used by the custom access token hook when picking the default
-- workspace for a user who belongs to multiple workspaces.
create or replace function public.is_workspace_member(_workspace_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = _workspace_id
      and user_id = _user_id
  );
$$;

grant execute on function public.is_workspace_member(uuid, uuid) to authenticated;

-- ─── Updated-at trigger helper ──────────────────────────────
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger workspaces_touch_updated_at
  before update on public.workspaces
  for each row execute function public.touch_updated_at();

-- ─── Indexes ────────────────────────────────────────────────
-- Slug lookup for subdomain routing.
create index workspaces_slug_idx on public.workspaces (slug);
-- Plan filter for billing queries.
create index workspaces_plan_idx on public.workspaces (plan);
