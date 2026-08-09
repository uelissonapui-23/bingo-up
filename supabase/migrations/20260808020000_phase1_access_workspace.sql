-- Fase 1: acesso, perfil, workspace do organizador e base definitiva de isolamento.

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_workspace_id uuid references public.workspaces(id) on delete set null,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

create policy user_preferences_self_select on public.user_preferences
for select to authenticated using (user_id = auth.uid());

create policy user_preferences_self_insert on public.user_preferences
for insert to authenticated with check (user_id = auth.uid());

create policy user_preferences_self_update on public.user_preferences
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.shares_workspace_with(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() = target_user_id
    or public.is_platform_admin()
    or exists (
      select 1
      from public.workspace_members mine
      join public.workspace_members theirs on theirs.workspace_id = mine.workspace_id
      where mine.user_id = auth.uid()
        and mine.status = 'active'
        and theirs.user_id = target_user_id
        and theirs.status = 'active'
    );
$$;

revoke all on function public.shares_workspace_with(uuid) from public;
grant execute on function public.shares_workspace_with(uuid) to authenticated;

drop policy if exists profiles_select_self_or_platform on public.profiles;
create policy profiles_select_related on public.profiles
for select to authenticated
using (public.shares_workspace_with(id));

create or replace function public.log_audit(
  target_workspace_id uuid,
  target_action text,
  target_entity_type text,
  target_entity_id text default null,
  target_metadata jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare new_id bigint;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not public.is_workspace_member(target_workspace_id) then raise exception 'workspace access denied'; end if;
  insert into public.audit_logs(workspace_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (target_workspace_id, auth.uid(), target_action, target_entity_type, target_entity_id, coalesce(target_metadata, '{}'::jsonb))
  returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.log_audit(uuid,text,text,text,jsonb) from public;
grant execute on function public.log_audit(uuid,text,text,text,jsonb) to authenticated;

create or replace function public.create_workspace(workspace_name text, workspace_slug text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  clean_name text := trim(workspace_name);
  clean_slug text := lower(trim(workspace_slug));
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if char_length(clean_name) < 2 or char_length(clean_name) > 120 then raise exception 'invalid workspace name'; end if;
  if clean_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then raise exception 'invalid workspace slug'; end if;

  insert into public.workspaces(name, slug, owner_user_id)
  values (clean_name, clean_slug, auth.uid()) returning id into new_id;

  insert into public.workspace_members(workspace_id, user_id, role, status)
  values (new_id, auth.uid(), 'organizer_owner', 'active');

  insert into public.workspace_settings(workspace_id) values (new_id);
  insert into public.user_preferences(user_id, last_workspace_id)
  values (auth.uid(), new_id)
  on conflict (user_id) do update set last_workspace_id = excluded.last_workspace_id, updated_at = now();

  insert into public.audit_logs(workspace_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (new_id, auth.uid(), 'workspace.created', 'workspace', new_id::text, jsonb_build_object('name', clean_name, 'slug', clean_slug));

  return new_id;
exception
  when unique_violation then
    raise exception 'workspace slug already in use';
end;
$$;

create or replace function public.set_last_workspace(target_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_workspace_member(target_workspace_id) then raise exception 'workspace access denied'; end if;
  insert into public.user_preferences(user_id, last_workspace_id)
  values (auth.uid(), target_workspace_id)
  on conflict (user_id) do update set last_workspace_id = excluded.last_workspace_id, updated_at = now();
end;
$$;

revoke all on function public.set_last_workspace(uuid) from public;
grant execute on function public.set_last_workspace(uuid) to authenticated;

create or replace function public.prevent_workspace_owner_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.owner_user_id is distinct from old.owner_user_id and not public.is_platform_admin() then
    raise exception 'workspace owner cannot be changed directly';
  end if;
  return new;
end;
$$;

drop trigger if exists workspaces_prevent_owner_change on public.workspaces;
create trigger workspaces_prevent_owner_change
before update on public.workspaces
for each row execute function public.prevent_workspace_owner_change();

create or replace function public.ensure_workspace_owner_membership()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.role = 'organizer_owner' and old.status = 'active' and
     (new.role is distinct from 'organizer_owner' or new.status is distinct from 'active') then
    if exists (select 1 from public.workspaces w where w.id = old.workspace_id and w.owner_user_id = old.user_id) then
      raise exception 'workspace owner membership cannot be revoked or downgraded';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists workspace_members_protect_owner on public.workspace_members;
create trigger workspace_members_protect_owner
before update on public.workspace_members
for each row execute function public.ensure_workspace_owner_membership();

create trigger user_preferences_set_updated_at before update on public.user_preferences
for each row execute function public.set_updated_at();

create index if not exists workspaces_owner_idx on public.workspaces(owner_user_id);
create index if not exists profiles_display_name_idx on public.profiles(display_name);
