-- ─── FormTrack — Forms + Form fields + Versions ────────────
-- Forms are the primary user-facing object. Each form belongs
-- to exactly one workspace. Fields are a separate table (not
-- jsonb on the form row) so the builder can update individual
-- fields without rewriting the whole form and so we can index
-- and query them.

-- ─── Forms ───────────────────────────────────────────────────
create table public.forms (
  id                   uuid primary key default gen_random_uuid(),
  workspace_id         uuid not null references public.workspaces(id) on delete cascade,

  title                text not null check (char_length(title) between 1 and 120),
  slug                 text not null check (slug ~ '^[a-z0-9][a-z0-9-]{0,60}$'),
  status               text not null default 'draft'
                       check (status in ('draft', 'published', 'archived')),

  theme                jsonb not null default '{}'::jsonb,
  submit_button_label  text not null default 'Submit',
  success_message      text not null default 'Thanks! We''ll be in touch.',

  auto_reply_enabled   boolean not null default false,
  auto_reply_template  text,
  connected_inbox_id   uuid,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  published_at         timestamptz,

  unique (workspace_id, slug)
);

-- Fast lookup by workspace.
create index forms_workspace_idx    on public.forms (workspace_id);
-- Dashboard lists active forms first.
create index forms_workspace_status_idx
  on public.forms (workspace_id, status)
  where status <> 'archived';

create trigger forms_touch_updated_at
  before update on public.forms
  for each row execute function public.touch_updated_at();

comment on table public.forms is
  'A lead capture form. Belongs to one workspace. RLS-scoped by workspace_id.';

-- ─── Form fields ─────────────────────────────────────────────
create table public.form_fields (
  id            uuid primary key default gen_random_uuid(),
  form_id       uuid not null references public.forms(id) on delete cascade,
  -- Denormalized workspace_id so RLS policies don't need a subquery.
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,

  type          text not null check (type in (
                  'short_text','long_text','email','phone','number',
                  'dropdown','checkbox','radio','date','file'
                )),
  label         text not null check (char_length(label) between 1 and 200),
  placeholder   text,
  help_text     text,
  required      boolean not null default false,
  options       jsonb not null default '[]'::jsonb,
  step_index    integer not null default 0 check (step_index >= 0),
  display_order integer not null default 0 check (display_order >= 0),

  created_at    timestamptz not null default now()
);

create index form_fields_form_idx       on public.form_fields (form_id);
create index form_fields_workspace_idx  on public.form_fields (workspace_id);

comment on column public.form_fields.workspace_id is
  'Denormalized from forms.workspace_id to make RLS policies a single-column comparison.';

-- ─── Form versions (publish history) ────────────────────────
-- Snapshot of the full form (fields + theme + settings) taken
-- every time a form transitions from draft -> published. This
-- is what the embed script actually serves to visitors so that
-- editing a form in draft mode never breaks a live embed.
create table public.form_versions (
  id            uuid primary key default gen_random_uuid(),
  form_id       uuid not null references public.forms(id) on delete cascade,
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  version       integer not null check (version >= 1),
  snapshot      jsonb not null,
  published_by  uuid references auth.users(id) on delete set null,
  published_at  timestamptz not null default now(),
  unique (form_id, version)
);

create index form_versions_form_idx
  on public.form_versions (form_id, version desc);
create index form_versions_workspace_idx
  on public.form_versions (workspace_id);
