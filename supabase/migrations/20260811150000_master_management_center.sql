-- Fase 13.2: central Master organizada para planos, clientes, usuarios, permissoes e auditoria.
-- Mantem o platform_owner como unica autoridade global e preserva as regras existentes do BINGOUP.

create table if not exists public.commercial_plans (
  code text primary key check (code ~ '^[a-z0-9_]+$'),
  name text not null check (char_length(name) between 2 and 80),
  description text,
  event_limit integer check (event_limit is null or event_limit >= 0),
  price_cents integer check (price_cents is null or price_cents >= 0),
  billing_label text,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.commercial_plans(code,name,description,event_limit,price_cents,billing_label,is_active,sort_order)
values
  ('single_event','Evento avulso','Acesso completo ao BINGOUP para 1 evento.',1,null,'por evento',true,10),
  ('pack_3','Pacote 3 eventos','Acesso completo para ate 3 eventos.',3,null,'pacote',true,20),
  ('pack_5','Pacote 5 eventos','Acesso completo para ate 5 eventos.',5,null,'pacote',true,30),
  ('unlimited','Ilimitado','Acesso completo sem limite de eventos.',null,null,'ilimitado',true,40)
on conflict(code) do nothing;

alter table public.workspace_licenses
  add column if not exists plan_code text references public.commercial_plans(code) on update cascade on delete set null;

create index if not exists workspace_licenses_plan_idx on public.workspace_licenses(plan_code,access_status);

create table if not exists public.platform_user_controls (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_status text not null default 'active' check (access_status in ('active','suspended')),
  reason text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.commercial_plans enable row level security;
alter table public.platform_user_controls enable row level security;

drop policy if exists commercial_plans_master_all on public.commercial_plans;
create policy commercial_plans_master_all on public.commercial_plans
for all to authenticated using(public.is_platform_owner()) with check(public.is_platform_owner());

drop policy if exists platform_user_controls_master_all on public.platform_user_controls;
create policy platform_user_controls_master_all on public.platform_user_controls
for all to authenticated using(public.is_platform_owner()) with check(public.is_platform_owner());

grant select,insert,update on public.commercial_plans to authenticated;
grant select,insert,update on public.platform_user_controls to authenticated;

create or replace function public.platform_user_access_allowed(target_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_platform_admin() or coalesce((
    select c.access_status='active' from public.platform_user_controls c where c.user_id=target_user_id
  ),true);
$$;
revoke all on function public.platform_user_access_allowed(uuid) from public;
grant execute on function public.platform_user_access_allowed(uuid) to authenticated;

-- Bloqueio global passa a valer para os papeis normais, sem retirar o acesso de suporte do platform_owner.
create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_platform_admin() or (
    public.platform_user_access_allowed(auth.uid()) and exists (
      select 1 from public.workspace_members wm
      join public.workspaces w on w.id=wm.workspace_id
      where wm.workspace_id=target_workspace_id and wm.user_id=auth.uid() and wm.status='active'
        and w.is_active and public.workspace_license_active(target_workspace_id)
    )
  );
$$;

create or replace function public.has_workspace_role(target_workspace_id uuid, allowed_roles public.workspace_role[])
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_platform_admin() or (
    public.platform_user_access_allowed(auth.uid()) and exists (
      select 1 from public.workspace_members wm
      join public.workspaces w on w.id=wm.workspace_id
      where wm.workspace_id=target_workspace_id and wm.user_id=auth.uid() and wm.status='active'
        and wm.role=any(allowed_roles) and w.is_active and public.workspace_license_active(target_workspace_id)
    )
  );
$$;

create or replace function public.seller_has_event_access(target_event_id uuid, target_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_platform_admin() or (
    public.platform_user_access_allowed(target_user_id) and exists(
      select 1
      from public.event_seller_assignments a
      join public.workspace_members wm on wm.workspace_id=a.workspace_id and wm.user_id=a.seller_user_id
      join public.workspaces w on w.id=a.workspace_id
      where a.event_id=target_event_id and a.seller_user_id=target_user_id and a.is_active
        and wm.status='active' and wm.role='seller' and w.is_active
        and public.workspace_license_active(a.workspace_id)
    )
  );
$$;

create or replace function public.draw_operator_has_event_access(target_event_id uuid,target_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_platform_admin() or (
    public.platform_user_access_allowed(target_user_id) and exists(
      select 1 from public.event_draw_operator_assignments a
      join public.workspace_members wm on wm.workspace_id=a.workspace_id and wm.user_id=a.operator_user_id
      join public.workspaces w on w.id=a.workspace_id
      where a.event_id=target_event_id and a.operator_user_id=target_user_id and a.is_active
        and wm.status='active' and wm.role::text='draw_operator' and w.is_active
        and public.workspace_license_active(a.workspace_id)
    )
  );
$$;

revoke all on function public.is_workspace_member(uuid) from public;
revoke all on function public.has_workspace_role(uuid,public.workspace_role[]) from public;
revoke all on function public.seller_has_event_access(uuid,uuid) from public;
revoke all on function public.draw_operator_has_event_access(uuid,uuid) from public;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.has_workspace_role(uuid,public.workspace_role[]) to authenticated;
grant execute on function public.seller_has_event_access(uuid,uuid) to authenticated;
grant execute on function public.draw_operator_has_event_access(uuid,uuid) to authenticated;

create or replace function public.list_master_plans()
returns table(code text,name text,description text,event_limit integer,price_cents integer,billing_label text,is_active boolean,sort_order integer)
language plpgsql stable security definer set search_path=public as $$
begin
  if not public.is_platform_owner() then raise exception 'master access denied'; end if;
  return query select p.code,p.name,p.description,p.event_limit,p.price_cents,p.billing_label,p.is_active,p.sort_order
    from public.commercial_plans p order by p.sort_order,p.name;
end; $$;
revoke all on function public.list_master_plans() from public;
grant execute on function public.list_master_plans() to authenticated;

create or replace function public.master_upsert_plan(
  target_code text,target_name text,target_description text,target_event_limit integer,
  target_price_cents integer,target_billing_label text,target_is_active boolean,target_sort_order integer
)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_platform_owner() then raise exception 'master access denied'; end if;
  if target_code !~ '^[a-z0-9_]+$' then raise exception 'invalid plan code'; end if;
  if char_length(trim(target_name))<2 then raise exception 'invalid plan name'; end if;
  if target_event_limit is not null and target_event_limit<0 then raise exception 'invalid event limit'; end if;
  if target_price_cents is not null and target_price_cents<0 then raise exception 'invalid price'; end if;
  insert into public.commercial_plans(code,name,description,event_limit,price_cents,billing_label,is_active,sort_order,updated_at)
  values(target_code,trim(target_name),nullif(trim(target_description),''),target_event_limit,target_price_cents,nullif(trim(target_billing_label),''),target_is_active,coalesce(target_sort_order,100),now())
  on conflict(code) do update set name=excluded.name,description=excluded.description,event_limit=excluded.event_limit,
    price_cents=excluded.price_cents,billing_label=excluded.billing_label,is_active=excluded.is_active,sort_order=excluded.sort_order,updated_at=now();
  insert into public.platform_master_audit_logs(actor_user_id,action,metadata)
  values(auth.uid(),'commercial.plan_saved',jsonb_build_object('code',target_code,'event_limit',target_event_limit,'active',target_is_active));
end; $$;
revoke all on function public.master_upsert_plan(text,text,text,integer,integer,text,boolean,integer) from public;
grant execute on function public.master_upsert_plan(text,text,text,integer,integer,text,boolean,integer) to authenticated;

-- Versao comercial da atualizacao de licenca: vincula plano e permite limite personalizado.
create or replace function public.master_update_workspace_access_v2(
  target_workspace_id uuid,target_access_status text,target_plan_code text default null,
  target_event_limit integer default null,target_valid_until timestamptz default null,target_notes text default null
)
returns void language plpgsql security definer set search_path=public as $$
declare plan_limit integer;
begin
  if not public.is_platform_owner() then raise exception 'master access denied'; end if;
  if target_access_status not in ('active','suspended','expired') then raise exception 'invalid access status'; end if;
  if target_event_limit is not null and target_event_limit<0 then raise exception 'invalid event limit'; end if;
  if target_plan_code is not null then
    select event_limit into plan_limit from public.commercial_plans where code=target_plan_code;
    if not found then raise exception 'plan not found'; end if;
  end if;
  insert into public.workspace_licenses(workspace_id,access_status,plan_code,event_limit,valid_until,notes,updated_at)
  values(target_workspace_id,target_access_status,target_plan_code,coalesce(target_event_limit,plan_limit),target_valid_until,nullif(trim(target_notes),''),now())
  on conflict(workspace_id) do update set access_status=excluded.access_status,plan_code=excluded.plan_code,
    event_limit=excluded.event_limit,valid_until=excluded.valid_until,notes=excluded.notes,updated_at=now();
  update public.workspaces set is_active=(target_access_status='active'),updated_at=now() where id=target_workspace_id;
  if not found then raise exception 'workspace not found'; end if;
  insert into public.platform_master_audit_logs(actor_user_id,action,target_workspace_id,metadata)
  values(auth.uid(),'workspace.license_updated',target_workspace_id,jsonb_build_object('status',target_access_status,'plan_code',target_plan_code,'event_limit',coalesce(target_event_limit,plan_limit),'valid_until',target_valid_until));
end; $$;
revoke all on function public.master_update_workspace_access_v2(uuid,text,text,integer,timestamptz,text) from public;
grant execute on function public.master_update_workspace_access_v2(uuid,text,text,integer,timestamptz,text) to authenticated;

create or replace function public.list_master_users()
returns table(user_id uuid,email text,display_name text,platform_access_status text,block_reason text,last_sign_in_at timestamptz,created_at timestamptz,memberships jsonb)
language plpgsql stable security definer set search_path=public as $$
begin
  if not public.is_platform_owner() then raise exception 'master access denied'; end if;
  return query
  select u.id,u.email::text,p.display_name,
    case when pm.role='platform_owner' then 'master' else coalesce(c.access_status,'active') end::text,
    c.reason,u.last_sign_in_at,u.created_at,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'workspace_id',wm.workspace_id,'workspace_name',w.name,'role',wm.role::text,'status',wm.status::text
      ) order by w.name)
      from public.workspace_members wm join public.workspaces w on w.id=wm.workspace_id where wm.user_id=u.id
    ),'[]'::jsonb)
  from auth.users u
  left join public.profiles p on p.id=u.id
  left join public.platform_user_controls c on c.user_id=u.id
  left join public.platform_members pm on pm.user_id=u.id
  order by u.created_at desc;
end; $$;
revoke all on function public.list_master_users() from public;
grant execute on function public.list_master_users() to authenticated;

create or replace function public.master_update_user_access(target_user_id uuid,target_access_status text,target_reason text default null)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_platform_owner() then raise exception 'master access denied'; end if;
  if target_access_status not in ('active','suspended') then raise exception 'invalid user access status'; end if;
  if exists(select 1 from public.platform_members where user_id=target_user_id and role='platform_owner') and target_access_status<>'active' then
    raise exception 'platform_owner cannot be suspended';
  end if;
  insert into public.platform_user_controls(user_id,access_status,reason,updated_by,updated_at)
  values(target_user_id,target_access_status,nullif(trim(target_reason),''),auth.uid(),now())
  on conflict(user_id) do update set access_status=excluded.access_status,reason=excluded.reason,updated_by=auth.uid(),updated_at=now();
  insert into public.platform_master_audit_logs(actor_user_id,action,metadata)
  values(auth.uid(),'user.access_updated',jsonb_build_object('user_id',target_user_id,'status',target_access_status,'reason',nullif(trim(target_reason),'')));
end; $$;
revoke all on function public.master_update_user_access(uuid,text,text) from public;
grant execute on function public.master_update_user_access(uuid,text,text) to authenticated;

create or replace function public.master_update_membership(target_workspace_id uuid,target_user_id uuid,target_role text,target_status text)
returns void language plpgsql security definer set search_path=public as $$
declare ws_owner uuid; new_role public.workspace_role; new_status public.membership_status;
begin
  if not public.is_platform_owner() then raise exception 'master access denied'; end if;
  select owner_user_id into ws_owner from public.workspaces where id=target_workspace_id;
  if ws_owner is null then raise exception 'workspace not found'; end if;
  if target_user_id=ws_owner then
    if target_role<>'organizer_owner' or target_status<>'active' then raise exception 'workspace owner role cannot be changed or suspended here'; end if;
  end if;
  begin new_role:=target_role::public.workspace_role; exception when others then raise exception 'invalid workspace role'; end;
  begin new_status:=target_status::public.membership_status; exception when others then raise exception 'invalid membership status'; end;
  update public.workspace_members set role=new_role,status=new_status,updated_at=now()
    where workspace_id=target_workspace_id and user_id=target_user_id;
  if not found then raise exception 'membership not found'; end if;
  insert into public.platform_master_audit_logs(actor_user_id,action,target_workspace_id,metadata)
  values(auth.uid(),'user.membership_updated',target_workspace_id,jsonb_build_object('user_id',target_user_id,'role',target_role,'status',target_status));
end; $$;
revoke all on function public.master_update_membership(uuid,uuid,text,text) from public;
grant execute on function public.master_update_membership(uuid,uuid,text,text) to authenticated;

create or replace function public.list_master_audit(limit_rows integer default 80)
returns table(id bigint,actor_email text,action text,target_workspace_id uuid,workspace_name text,metadata jsonb,created_at timestamptz)
language plpgsql stable security definer set search_path=public as $$
begin
  if not public.is_platform_owner() then raise exception 'master access denied'; end if;
  return query
    select l.id,u.email::text,l.action,l.target_workspace_id,w.name,l.metadata,l.created_at
    from public.platform_master_audit_logs l
    left join auth.users u on u.id=l.actor_user_id
    left join public.workspaces w on w.id=l.target_workspace_id
    order by l.created_at desc limit greatest(1,least(coalesce(limit_rows,80),200));
end; $$;
revoke all on function public.list_master_audit(integer) from public;
grant execute on function public.list_master_audit(integer) to authenticated;

-- A listagem de clientes passa a devolver o plano vinculado.
drop function if exists public.list_master_workspaces();
create function public.list_master_workspaces()
returns table(workspace_id uuid,name text,slug text,owner_user_id uuid,owner_email text,is_active boolean,access_status text,plan_code text,event_limit integer,valid_until timestamptz,notes text,events_total bigint,events_active bigint,members_total bigint,cards_sold bigint,sales_amount numeric)
language plpgsql stable security definer set search_path=public as $$
begin
  if not public.is_platform_owner() then raise exception 'master access denied'; end if;
  return query
  select w.id,w.name,w.slug,w.owner_user_id,u.email::text,w.is_active,l.access_status::text,l.plan_code,l.event_limit,l.valid_until,l.notes,
    (select count(*) from public.events e where e.workspace_id=w.id),
    (select count(*) from public.events e where e.workspace_id=w.id and e.status not in ('finished','canceled','archived')),
    (select count(*) from public.workspace_members wm where wm.workspace_id=w.id and wm.status='active'),
    (select count(*) from public.physical_cards c where c.workspace_id=w.id and c.status='sold'),
    coalesce((select sum(s.total_amount) from public.sales s where s.workspace_id=w.id and s.status='completed'),0)::numeric
  from public.workspaces w
  left join public.workspace_licenses l on l.workspace_id=w.id
  left join auth.users u on u.id=w.owner_user_id
  order by w.created_at desc;
end; $$;
revoke all on function public.list_master_workspaces() from public;
grant execute on function public.list_master_workspaces() to authenticated;
