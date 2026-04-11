-- ─── FormTrack — Integrations (OAuth token storage) ────────
-- Encrypted-at-rest OAuth tokens for connected inboxes
-- (Gmail / Outlook) and Stripe customer refs. Tokens are
-- scoped to the workspace, not the user who connected them,
-- so a workspace can outlive any individual admin.
--
-- Encryption strategy:
--   - pgsodium / pgcrypto + a server-held key (env: OAUTH_TOKEN_ENCRYPTION_KEY)
--   - Tokens are encrypted by the infrastructure layer BEFORE
--     being written. The column type is bytea to make that
--     obvious at the schema level.

create table public.integrations (
  id                        uuid primary key default gen_random_uuid(),
  workspace_id              uuid not null references public.workspaces(id) on delete cascade,

  provider                  text not null check (provider in ('google','microsoft','stripe')),
  provider_account_id       text,          -- provider's stable account id
  account_email             text,          -- display-only, e.g. "oba@acme.com"
  scopes                    text[]  not null default '{}',

  -- Encrypted by application layer before insert.
  access_token_encrypted    bytea,
  refresh_token_encrypted   bytea,
  token_expires_at          timestamptz,

  -- Status for the connection.
  status                    text not null default 'active'
                            check (status in ('active','expired','revoked','error')),
  last_error                text,

  connected_by              uuid references auth.users(id) on delete set null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  -- One active connection per provider per workspace.
  unique (workspace_id, provider, provider_account_id)
);

create index integrations_workspace_idx
  on public.integrations (workspace_id);
create index integrations_workspace_provider_idx
  on public.integrations (workspace_id, provider)
  where status = 'active';

create trigger integrations_touch_updated_at
  before update on public.integrations
  for each row execute function public.touch_updated_at();

-- ─── Forms ← integrations (connected inbox) ────────────────
-- A form can auto-reply from a specific connected inbox. We
-- add the FK now so step 11 (auto-reply) has somewhere to point.
alter table public.forms
  add constraint forms_connected_inbox_id_fkey
  foreign key (connected_inbox_id)
  references public.integrations(id)
  on delete set null;

comment on table public.integrations is
  'OAuth connections (Gmail, Outlook, Stripe). Access + refresh tokens are stored encrypted-at-rest and should only be decrypted inside src/infrastructure/{google,microsoft,stripe}.';
