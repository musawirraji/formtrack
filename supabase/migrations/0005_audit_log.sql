-- ─── FormTrack — Audit log ─────────────────────────────────
-- Append-only record of security-relevant actions. Added in
-- step 2 so every subsequent step can write to it from day one
-- rather than bolting it on in step 13.

create table public.audit_log (
  id              bigserial primary key,
  workspace_id    uuid references public.workspaces(id) on delete cascade,
  actor_user_id   uuid references auth.users(id)        on delete set null,
  action          text not null,
  resource_type   text,
  resource_id     text,
  metadata        jsonb not null default '{}'::jsonb,
  ip_hash         text,
  created_at      timestamptz not null default now()
);

create index audit_log_workspace_created_idx
  on public.audit_log (workspace_id, created_at desc);

create index audit_log_action_idx
  on public.audit_log (action, created_at desc);

comment on table public.audit_log is
  'Append-only audit trail. Writes ONLY from the infrastructure layer (never from feature code). Reads are admin-only.';

-- Audit log rows are immutable once written.
create or replace function public.reject_audit_log_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_log is append-only';
end;
$$;

create trigger audit_log_no_update
  before update on public.audit_log
  for each row execute function public.reject_audit_log_mutation();

create trigger audit_log_no_delete
  before delete on public.audit_log
  for each row execute function public.reject_audit_log_mutation();
