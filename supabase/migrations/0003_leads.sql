-- ─── FormTrack — Leads (submissions with normalized attribution) ─
-- A lead is one form submission. The attribution resolver
-- (src/domain/lead/attribution.ts) runs on the incoming
-- submission and writes the normalized fields inline — we
-- keep the raw payload too for auditability.

create table public.leads (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  form_id       uuid not null references public.forms(id)      on delete cascade,

  -- Submitted field values, keyed by form_field.id.
  values        jsonb not null default '{}'::jsonb,

  -- Contact fields promoted for fast table rendering + search.
  email         text,
  name          text,
  phone         text,

  -- Normalized attribution (output of resolveAttribution()).
  source_channel       text not null check (source_channel in (
                         'meta_ads','google_ads','google_organic',
                         'organic','direct','email','referral','other'
                       )),
  source_label         text not null,
  source_campaign      text,
  source_referrer_host text,
  source_explanation   text not null,
  source_confidence    text not null check (source_confidence in ('high','medium','low')),

  -- Raw payload the embed captured (audit trail).
  attribution_raw      jsonb not null,

  -- Request metadata (no raw IPs — hashed for privacy).
  ip_hash       text,
  country       text,
  user_agent    text,

  created_at    timestamptz not null default now()
);

-- Dashboard: latest leads for a workspace.
create index leads_workspace_created_idx
  on public.leads (workspace_id, created_at desc);

-- "Where are leads from form X coming from" drilldown.
create index leads_form_created_idx
  on public.leads (form_id, created_at desc);

-- Source breakdown charts.
create index leads_workspace_source_idx
  on public.leads (workspace_id, source_channel);

-- Search by email (case-insensitive).
create index leads_workspace_email_idx
  on public.leads (workspace_id, lower(email))
  where email is not null;

comment on table public.leads is
  'One row per form submission. Attribution is resolved server-side at insert time and stored inline so dashboards never need to re-compute.';
