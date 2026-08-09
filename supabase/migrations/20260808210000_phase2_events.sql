-- Fase 2: Eventos completos para o MVP, preparados para vendedores, sorteio e SaaS.

create type public.event_status as enum (
  'draft',
  'sales_open',
  'sales_paused',
  'ready',
  'drawing',
  'paused',
  'finished',
  'canceled',
  'archived'
);

create type public.event_sales_mode as enum ('open_pool', 'assigned_cards');

create table public.events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 160),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  public_code text not null unique default upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 12)),
  description text,
  location_name text,
  address text,
  starts_at timestamptz,
  ends_at timestamptz,
  sales_open_at timestamptz,
  sales_close_at timestamptz,
  status public.event_status not null default 'draft',
  banner_path text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, slug),
  check (ends_at is null or starts_at is null or ends_at >= starts_at),
  check (sales_close_at is null or sales_open_at is null or sales_close_at >= sales_open_at)
);

create table public.event_settings (
  event_id uuid primary key references public.events(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  timezone text not null default 'America/Sao_Paulo',
  currency text not null default 'BRL',
  default_card_price numeric(12,2) not null default 0 check (default_card_price >= 0),
  require_buyer_name boolean not null default true,
  require_buyer_phone boolean not null default false,
  require_buyer_email boolean not null default false,
  allow_reservations boolean not null default true,
  reservation_minutes integer not null default 10 check (reservation_minutes between 1 and 1440),
  sales_mode public.event_sales_mode not null default 'open_pool',
  public_panel_show_last_number boolean not null default true,
  public_panel_show_called_numbers boolean not null default true,
  public_panel_show_progress boolean not null default true,
  public_panel_show_near_winners boolean not null default true,
  near_winner_thresholds smallint[] not null default array[1,2]::smallint[],
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, event_id)
);

create index events_workspace_status_idx on public.events(workspace_id, status, starts_at desc nulls last);
create index events_workspace_created_idx on public.events(workspace_id, created_at desc);
create index events_public_code_idx on public.events(public_code);
create index event_settings_workspace_idx on public.event_settings(workspace_id);

alter table public.events enable row level security;
alter table public.event_settings enable row level security;

create policy events_member_select on public.events
for select to authenticated
using (public.is_workspace_member(workspace_id));

create policy events_admin_insert on public.events
for insert to authenticated
with check (
  public.has_workspace_role(workspace_id, array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[])
  and (created_by is null or created_by = auth.uid() or public.is_platform_admin())
);

create policy events_admin_update on public.events
for update to authenticated
using (public.has_workspace_role(workspace_id, array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]))
with check (public.has_workspace_role(workspace_id, array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]));

create policy events_admin_delete on public.events
for delete to authenticated
using (public.has_workspace_role(workspace_id, array['organizer_owner','organizer_admin']::public.workspace_role[]));

create policy event_settings_member_select on public.event_settings
for select to authenticated
using (public.is_workspace_member(workspace_id));

create policy event_settings_admin_insert on public.event_settings
for insert to authenticated
with check (public.has_workspace_role(workspace_id, array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]));

create policy event_settings_admin_update on public.event_settings
for update to authenticated
using (public.has_workspace_role(workspace_id, array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]))
with check (public.has_workspace_role(workspace_id, array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]));

create or replace function public.create_event_with_settings(
  target_workspace_id uuid,
  event_name text,
  event_slug text,
  event_description text default null,
  event_location_name text default null,
  event_address text default null,
  event_starts_at timestamptz default null,
  event_ends_at timestamptz default null,
  event_sales_open_at timestamptz default null,
  event_sales_close_at timestamptz default null,
  event_default_card_price numeric default 0
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  clean_name text := trim(event_name);
  clean_slug text := lower(trim(event_slug));
  workspace_tz text;
  workspace_currency text;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not public.has_workspace_role(target_workspace_id, array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) then
    raise exception 'event creation denied';
  end if;
  if char_length(clean_name) < 2 or char_length(clean_name) > 160 then raise exception 'invalid event name'; end if;
  if clean_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then raise exception 'invalid event slug'; end if;
  if event_ends_at is not null and event_starts_at is not null and event_ends_at < event_starts_at then raise exception 'invalid event period'; end if;
  if event_sales_close_at is not null and event_sales_open_at is not null and event_sales_close_at < event_sales_open_at then raise exception 'invalid sales period'; end if;
  if coalesce(event_default_card_price, 0) < 0 then raise exception 'invalid card price'; end if;

  select timezone, currency into workspace_tz, workspace_currency
  from public.workspace_settings where workspace_id = target_workspace_id;

  insert into public.events(
    workspace_id, name, slug, description, location_name, address,
    starts_at, ends_at, sales_open_at, sales_close_at, created_by
  ) values (
    target_workspace_id, clean_name, clean_slug, nullif(trim(event_description), ''),
    nullif(trim(event_location_name), ''), nullif(trim(event_address), ''),
    event_starts_at, event_ends_at, event_sales_open_at, event_sales_close_at, auth.uid()
  ) returning id into new_id;

  insert into public.event_settings(event_id, workspace_id, timezone, currency, default_card_price)
  values (new_id, target_workspace_id, coalesce(workspace_tz, 'America/Sao_Paulo'), coalesce(workspace_currency, 'BRL'), coalesce(event_default_card_price, 0));

  perform public.log_audit(target_workspace_id, 'event.created', 'event', new_id::text,
    jsonb_build_object('name', clean_name, 'slug', clean_slug));

  return new_id;
exception
  when unique_violation then
    raise exception 'event slug already in use';
end;
$$;

revoke all on function public.create_event_with_settings(uuid,text,text,text,text,text,timestamptz,timestamptz,timestamptz,timestamptz,numeric) from public;
grant execute on function public.create_event_with_settings(uuid,text,text,text,text,text,timestamptz,timestamptz,timestamptz,timestamptz,numeric) to authenticated;

create or replace function public.archive_event(target_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare target_workspace uuid;
begin
  select workspace_id into target_workspace from public.events where id = target_event_id;
  if target_workspace is null then raise exception 'event not found'; end if;
  if not public.has_workspace_role(target_workspace, array['organizer_owner','organizer_admin']::public.workspace_role[]) then raise exception 'event archive denied'; end if;

  update public.events
  set status = 'archived', archived_at = now(), updated_at = now()
  where id = target_event_id;

  perform public.log_audit(target_workspace, 'event.archived', 'event', target_event_id::text, '{}'::jsonb);
end;
$$;
revoke all on function public.archive_event(uuid) from public;
grant execute on function public.archive_event(uuid) to authenticated;

create or replace function public.restore_event(target_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare target_workspace uuid;
begin
  select workspace_id into target_workspace from public.events where id = target_event_id;
  if target_workspace is null then raise exception 'event not found'; end if;
  if not public.has_workspace_role(target_workspace, array['organizer_owner','organizer_admin']::public.workspace_role[]) then raise exception 'event restore denied'; end if;

  update public.events set status = 'draft', archived_at = null, updated_at = now() where id = target_event_id;
  perform public.log_audit(target_workspace, 'event.restored', 'event', target_event_id::text, '{}'::jsonb);
end;
$$;
revoke all on function public.restore_event(uuid) from public;
grant execute on function public.restore_event(uuid) to authenticated;

create trigger events_set_updated_at before update on public.events for each row execute function public.set_updated_at();
create trigger event_settings_set_updated_at before update on public.event_settings for each row execute function public.set_updated_at();

-- Bucket privado para banners/logos do organizador e dos eventos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-assets', 'event-assets', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy event_assets_member_read on storage.objects
for select to authenticated
using (
  bucket_id = 'event-assets'
  and public.is_workspace_member((storage.foldername(name))[1]::uuid)
);

create policy event_assets_admin_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'event-assets'
  and public.has_workspace_role((storage.foldername(name))[1]::uuid, array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[])
);

create policy event_assets_admin_update on storage.objects
for update to authenticated
using (
  bucket_id = 'event-assets'
  and public.has_workspace_role((storage.foldername(name))[1]::uuid, array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[])
)
with check (
  bucket_id = 'event-assets'
  and public.has_workspace_role((storage.foldername(name))[1]::uuid, array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[])
);

create policy event_assets_admin_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'event-assets'
  and public.has_workspace_role((storage.foldername(name))[1]::uuid, array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[])
);
