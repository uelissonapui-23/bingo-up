-- Fase 0: fundação multi-tenant. Funcionalidades específicas entram nos módulos seguintes.

create extension if not exists pgcrypto;

create type public.platform_role as enum ('platform_owner', 'platform_admin');
create type public.workspace_role as enum ('organizer_owner', 'organizer_admin', 'event_manager', 'seller');
create type public.membership_status as enum ('invited', 'active', 'suspended', 'revoked');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.platform_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.platform_role not null,
  created_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  owner_user_id uuid not null references auth.users(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.workspace_role not null,
  status public.membership_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index workspace_members_user_idx on public.workspace_members(user_id, status);
create index workspace_members_workspace_idx on public.workspace_members(workspace_id, status);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_workspace_created_idx on public.audit_logs(workspace_id, created_at desc);

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.platform_members pm
    where pm.user_id = auth.uid()
      and pm.role in ('platform_owner', 'platform_admin')
  );
$$;

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_admin() or exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
  );
$$;

create or replace function public.has_workspace_role(target_workspace_id uuid, allowed_roles public.workspace_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_admin() or exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
      and wm.role = any(allowed_roles)
  );
$$;

revoke all on function public.is_platform_admin() from public;
revoke all on function public.is_workspace_member(uuid) from public;
revoke all on function public.has_workspace_role(uuid, public.workspace_role[]) from public;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.has_workspace_role(uuid, public.workspace_role[]) to authenticated;

alter table public.profiles enable row level security;
alter table public.platform_members enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_select_self_or_platform on public.profiles
for select to authenticated
using (id = auth.uid() or public.is_platform_admin());

create policy profiles_update_self on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy platform_members_platform_only on public.platform_members
for select to authenticated
using (public.is_platform_admin());

create policy workspaces_select_member on public.workspaces
for select to authenticated
using (public.is_workspace_member(id));

create policy workspaces_update_admin on public.workspaces
for update to authenticated
using (public.has_workspace_role(id, array['organizer_owner','organizer_admin']::public.workspace_role[]))
with check (public.has_workspace_role(id, array['organizer_owner','organizer_admin']::public.workspace_role[]));

create policy workspace_members_select_same_workspace on public.workspace_members
for select to authenticated
using (public.is_workspace_member(workspace_id));

create policy workspace_members_manage_admin on public.workspace_members
for all to authenticated
using (public.has_workspace_role(workspace_id, array['organizer_owner','organizer_admin']::public.workspace_role[]))
with check (public.has_workspace_role(workspace_id, array['organizer_owner','organizer_admin']::public.workspace_role[]));

create policy audit_logs_select_admin on public.audit_logs
for select to authenticated
using (workspace_id is not null and public.has_workspace_role(workspace_id, array['organizer_owner','organizer_admin']::public.workspace_role[]));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
