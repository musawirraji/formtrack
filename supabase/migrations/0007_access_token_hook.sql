-- ─── FormTrack — Custom access token hook ─────────────────
-- Runs on every auth token issuance (login, refresh, etc).
-- Picks the user's active workspace and writes it into the
-- JWT's app_metadata so RLS policies can read it without an
-- extra round trip.
--
-- Pick order:
--   1. If the user has an `active_workspace_id` in their
--      profile, use that.
--   2. Else, the first workspace they're a member of (oldest).
--
-- Register this in the Supabase dashboard:
--   Authentication → Hooks → Custom Access Token Hook
--   → public.custom_access_token_hook

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  claims       jsonb;
  user_id      uuid;
  workspace_id uuid;
begin
  claims := event -> 'claims';
  user_id := (event ->> 'user_id')::uuid;

  -- First workspace the user joined (oldest membership wins).
  select wm.workspace_id into workspace_id
  from public.workspace_members wm
  where wm.user_id = custom_access_token_hook.user_id
  order by wm.joined_at asc
  limit 1;

  if workspace_id is not null then
    if claims ? 'app_metadata' then
      claims := jsonb_set(
        claims,
        '{app_metadata,workspace_id}',
        to_jsonb(workspace_id::text)
      );
    else
      claims := jsonb_set(
        claims,
        '{app_metadata}',
        jsonb_build_object('workspace_id', workspace_id::text)
      );
    end if;
  end if;

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

grant execute on function public.custom_access_token_hook(jsonb)
  to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb)
  from authenticated, anon, public;

comment on function public.custom_access_token_hook(jsonb) is
  'Writes the user''s active workspace_id into the JWT app_metadata. Register under Supabase Auth Hooks.';
