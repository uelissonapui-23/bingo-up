-- Fase 13: painel Master comercial, licenças por workspace e identidade global.
-- Segurança: somente platform_owner gerencia a plataforma. platform_admin não recebe acesso Master automaticamente.

create table if not exists public.workspace_licenses (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  access_status text not null default 'active' check (access_status in ('active','suspended','expired')),
  event_limit integer check (event_limit is null or event_limit >= 0),
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.workspace_licenses(workspace_id,access_status,event_limit)
select id,'active',null from public.workspaces
on conflict(workspace_id) do nothing;

create table if not exists public.platform_branding (
  id smallint primary key default 1 check (id=1),
  app_name text not null default 'BINGOUP' check (char_length(trim(app_name)) between 2 and 80),
  main_logo_path text,
  auth_logo_path text,
  compact_logo_path text,
  public_panel_logo_path text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.platform_branding(id) values(1) on conflict(id) do nothing;

create table if not exists public.platform_master_audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_workspace_id uuid references public.workspaces(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists platform_master_audit_created_idx on public.platform_master_audit_logs(created_at desc);

create or replace function public.is_platform_owner()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.platform_members where user_id=auth.uid() and role='platform_owner');
$$;
revoke all on function public.is_platform_owner() from public;
grant execute on function public.is_platform_owner() to authenticated;

create or replace function public.workspace_license_active(target_workspace_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select coalesce((
    select wl.access_status='active'
      and (wl.valid_until is null or wl.valid_until >= now())
    from public.workspace_licenses wl where wl.workspace_id=target_workspace_id
  ), true);
$$;
revoke all on function public.workspace_license_active(uuid) from public;
grant execute on function public.workspace_license_active(uuid) to authenticated;

-- Mantém o Master com acesso de suporte, mas bloqueia usuários comuns quando o workspace/licença estiver suspenso.
create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_platform_admin() or exists (
    select 1 from public.workspace_members wm
    join public.workspaces w on w.id=wm.workspace_id
    where wm.workspace_id=target_workspace_id and wm.user_id=auth.uid() and wm.status='active'
      and w.is_active and public.workspace_license_active(target_workspace_id)
  );
$$;

create or replace function public.has_workspace_role(target_workspace_id uuid, allowed_roles public.workspace_role[])
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_platform_admin() or exists (
    select 1 from public.workspace_members wm
    join public.workspaces w on w.id=wm.workspace_id
    where wm.workspace_id=target_workspace_id and wm.user_id=auth.uid() and wm.status='active'
      and wm.role=any(allowed_roles) and w.is_active and public.workspace_license_active(target_workspace_id)
  );
$$;

create or replace function public.enforce_workspace_event_license()
returns trigger language plpgsql security definer set search_path=public as $$
declare lim integer; current_count integer; stat text; expiry timestamptz;
begin
  if public.is_platform_owner() then return new; end if;
  select access_status,event_limit,valid_until into stat,lim,expiry from public.workspace_licenses where workspace_id=new.workspace_id;
  if stat is null then return new; end if;
  if stat<>'active' or (expiry is not null and expiry<now()) then raise exception 'A licença deste organizador não está ativa.'; end if;
  if lim is not null then
    select count(*) into current_count from public.events where workspace_id=new.workspace_id;
    if current_count>=lim then raise exception 'Limite de eventos da licença atingido (%).',lim; end if;
  end if;
  return new;
end; $$;
drop trigger if exists trg_enforce_workspace_event_license on public.events;
create trigger trg_enforce_workspace_event_license before insert on public.events for each row execute function public.enforce_workspace_event_license();

-- Novos workspaces continuam funcionais e entram no Master como ilimitados até o proprietário definir o pacote comercial.
create or replace function public.attach_default_workspace_license()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.workspace_licenses(workspace_id,access_status,event_limit) values(new.id,'active',null) on conflict do nothing;
  return new;
end; $$;
drop trigger if exists trg_attach_default_workspace_license on public.workspaces;
create trigger trg_attach_default_workspace_license after insert on public.workspaces for each row execute function public.attach_default_workspace_license();

alter table public.workspace_licenses enable row level security;
alter table public.platform_branding enable row level security;
alter table public.platform_master_audit_logs enable row level security;

drop policy if exists workspace_licenses_master_select on public.workspace_licenses;
create policy workspace_licenses_master_select on public.workspace_licenses for select to authenticated using(public.is_platform_owner());
drop policy if exists platform_branding_master_all on public.platform_branding;
create policy platform_branding_master_all on public.platform_branding for all to authenticated using(public.is_platform_owner()) with check(public.is_platform_owner());
drop policy if exists platform_master_audit_owner_select on public.platform_master_audit_logs;
create policy platform_master_audit_owner_select on public.platform_master_audit_logs for select to authenticated using(public.is_platform_owner());

create or replace function public.get_public_platform_branding()
returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object('app_name',app_name,'main_logo_path',main_logo_path,'auth_logo_path',auth_logo_path,'compact_logo_path',compact_logo_path,'public_panel_logo_path',public_panel_logo_path)
  from public.platform_branding where id=1;
$$;
revoke all on function public.get_public_platform_branding() from public;
grant execute on function public.get_public_platform_branding() to anon,authenticated;

create or replace function public.get_master_dashboard()
returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
  if not public.is_platform_owner() then raise exception 'master access denied'; end if;
  return jsonb_build_object(
    'workspaces_total',(select count(*) from public.workspaces),
    'workspaces_active',(select count(*) from public.workspaces w join public.workspace_licenses l on l.workspace_id=w.id where w.is_active and l.access_status='active' and (l.valid_until is null or l.valid_until>=now())),
    'events_total',(select count(*) from public.events),
    'users_total',(select count(*) from public.profiles),
    'cards_sold',(select count(*) from public.physical_cards where status='sold'),
    'sales_amount',coalesce((select sum(total_amount) from public.sales where status='completed'),0)
  );
end; $$;
revoke all on function public.get_master_dashboard() from public;
grant execute on function public.get_master_dashboard() to authenticated;

create or replace function public.list_master_workspaces()
returns table(workspace_id uuid,name text,slug text,owner_user_id uuid,owner_email text,is_active boolean,access_status text,event_limit integer,valid_until timestamptz,notes text,events_total bigint,events_active bigint,members_total bigint,cards_sold bigint,sales_amount numeric)
language plpgsql stable security definer set search_path=public as $$
begin
  if not public.is_platform_owner() then raise exception 'master access denied'; end if;
  return query
  select w.id,w.name,w.slug,w.owner_user_id,u.email,w.is_active,l.access_status,l.event_limit,l.valid_until,l.notes,
    (select count(*) from public.events e where e.workspace_id=w.id),
    (select count(*) from public.events e where e.workspace_id=w.id and e.status not in ('finished','canceled','archived')),
    (select count(*) from public.workspace_members wm where wm.workspace_id=w.id and wm.status='active'),
    (select count(*) from public.physical_cards c where c.workspace_id=w.id and c.status='sold'),
    coalesce((select sum(s.total_amount) from public.sales s where s.workspace_id=w.id and s.status='completed'),0)
  from public.workspaces w
  join public.workspace_licenses l on l.workspace_id=w.id
  left join auth.users u on u.id=w.owner_user_id
  order by w.created_at desc;
end; $$;
revoke all on function public.list_master_workspaces() from public;
grant execute on function public.list_master_workspaces() to authenticated;

create or replace function public.master_update_workspace_access(target_workspace_id uuid,target_access_status text,target_event_limit integer default null,target_valid_until timestamptz default null,target_notes text default null)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_platform_owner() then raise exception 'master access denied'; end if;
  if target_access_status not in ('active','suspended','expired') then raise exception 'invalid access status'; end if;
  if target_event_limit is not null and target_event_limit<0 then raise exception 'invalid event limit'; end if;
  insert into public.workspace_licenses(workspace_id,access_status,event_limit,valid_until,notes,updated_at)
  values(target_workspace_id,target_access_status,target_event_limit,target_valid_until,nullif(trim(target_notes),''),now())
  on conflict(workspace_id) do update set access_status=excluded.access_status,event_limit=excluded.event_limit,valid_until=excluded.valid_until,notes=excluded.notes,updated_at=now();
  update public.workspaces set is_active=(target_access_status='active'),updated_at=now() where id=target_workspace_id;
  if not found then raise exception 'workspace not found'; end if;
  insert into public.platform_master_audit_logs(actor_user_id,action,target_workspace_id,metadata)
  values(auth.uid(),'workspace.license_updated',target_workspace_id,jsonb_build_object('status',target_access_status,'event_limit',target_event_limit,'valid_until',target_valid_until));
end; $$;
revoke all on function public.master_update_workspace_access(uuid,text,integer,timestamptz,text) from public;
grant execute on function public.master_update_workspace_access(uuid,text,integer,timestamptz,text) to authenticated;

create or replace function public.master_update_platform_branding(target_app_name text,target_main_logo_path text default null,target_auth_logo_path text default null,target_compact_logo_path text default null,target_public_panel_logo_path text default null)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_platform_owner() then raise exception 'master access denied'; end if;
  if char_length(trim(target_app_name))<2 then raise exception 'invalid app name'; end if;
  update public.platform_branding set app_name=trim(target_app_name),main_logo_path=target_main_logo_path,auth_logo_path=target_auth_logo_path,compact_logo_path=target_compact_logo_path,public_panel_logo_path=target_public_panel_logo_path,updated_by=auth.uid(),updated_at=now() where id=1;
  insert into public.platform_master_audit_logs(actor_user_id,action,metadata) values(auth.uid(),'platform.branding_updated',jsonb_build_object('app_name',trim(target_app_name)));
end; $$;
revoke all on function public.master_update_platform_branding(text,text,text,text,text) from public;
grant execute on function public.master_update_platform_branding(text,text,text,text,text) to authenticated;

-- Bucket público apenas para identidade visual. Escrita é exclusiva do platform_owner.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('platform-branding','platform-branding',true,5242880,array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists platform_branding_owner_insert on storage.objects;
create policy platform_branding_owner_insert on storage.objects for insert to authenticated with check(bucket_id='platform-branding' and public.is_platform_owner());
drop policy if exists platform_branding_owner_update on storage.objects;
create policy platform_branding_owner_update on storage.objects for update to authenticated using(bucket_id='platform-branding' and public.is_platform_owner()) with check(bucket_id='platform-branding' and public.is_platform_owner());
drop policy if exists platform_branding_owner_delete on storage.objects;
create policy platform_branding_owner_delete on storage.objects for delete to authenticated using(bucket_id='platform-branding' and public.is_platform_owner());

-- Grants explícitos usados pelo Data API.
grant select on public.workspace_licenses to authenticated;
grant select,update on public.platform_branding to authenticated;
grant select on public.platform_master_audit_logs to authenticated;

