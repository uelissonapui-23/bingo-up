-- Fase 15: centrais multi-papel (organizador, vendedor, operador e comprador digital).
-- Uma identidade Auth pode acumular acessos independentes sem ganhar licença comercial de organizador.

create table if not exists public.workspace_operational_memberships (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('seller','draw_operator')),
  status public.membership_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(workspace_id,user_id,role)
);
create index if not exists workspace_operational_memberships_user_idx on public.workspace_operational_memberships(user_id,role,status);
alter table public.workspace_operational_memberships enable row level security;

drop policy if exists operational_memberships_self_read on public.workspace_operational_memberships;
create policy operational_memberships_self_read on public.workspace_operational_memberships for select to authenticated
using(user_id=auth.uid() or public.has_workspace_role(workspace_id,array['organizer_owner','organizer_admin']::public.workspace_role[]));

grant select on public.workspace_operational_memberships to authenticated;

-- Migra os papéis operacionais legados sem apagar workspace_members.
insert into public.workspace_operational_memberships(workspace_id,user_id,role,status)
select workspace_id,user_id,role::text,status from public.workspace_members where role::text in ('seller','draw_operator')
on conflict(workspace_id,user_id,role) do update set status=excluded.status,updated_at=now();

-- Convites/atribuições existentes também são fonte válida.
insert into public.workspace_operational_memberships(workspace_id,user_id,role,status)
select distinct workspace_id,seller_user_id,'seller','active'::public.membership_status from public.event_seller_assignments where is_active
on conflict(workspace_id,user_id,role) do nothing;
insert into public.workspace_operational_memberships(workspace_id,user_id,role,status)
select distinct workspace_id,operator_user_id,'draw_operator','active'::public.membership_status from public.event_draw_operator_assignments where is_active
on conflict(workspace_id,user_id,role) do nothing;

create or replace function public.operational_user_access_allowed(target_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.platform_members pm where pm.user_id=target_user_id and pm.role='platform_owner')
    or coalesce((select c.access_status='active' or (c.access_status='suspended' and c.reason in ('Aguardando liberação comercial','Acesso operacional por convite; licença de organizador não liberada')) from public.platform_user_controls c where c.user_id=target_user_id),false);
$$;
revoke all on function public.operational_user_access_allowed(uuid) from public;
grant execute on function public.operational_user_access_allowed(uuid) to authenticated;

create or replace function public.seller_has_event_access(target_event_id uuid, target_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_platform_owner() or (
    public.operational_user_access_allowed(target_user_id) and exists(
      select 1 from public.event_seller_assignments a
      join public.workspace_operational_memberships m on m.workspace_id=a.workspace_id and m.user_id=a.seller_user_id and m.role='seller'
      join public.workspaces w on w.id=a.workspace_id
      where a.event_id=target_event_id and a.seller_user_id=target_user_id and a.is_active and m.status='active'
        and w.is_active and public.workspace_license_active(a.workspace_id)
    )
  );
$$;

create or replace function public.draw_operator_has_event_access(target_event_id uuid,target_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_platform_owner() or (
    public.operational_user_access_allowed(target_user_id) and exists(
      select 1 from public.event_draw_operator_assignments a
      join public.workspace_operational_memberships m on m.workspace_id=a.workspace_id and m.user_id=a.operator_user_id and m.role='draw_operator'
      join public.workspaces w on w.id=a.workspace_id
      where a.event_id=target_event_id and a.operator_user_id=target_user_id and a.is_active and m.status='active'
        and w.is_active and public.workspace_license_active(a.workspace_id)
    )
  );
$$;
revoke all on function public.seller_has_event_access(uuid,uuid) from public;
revoke all on function public.draw_operator_has_event_access(uuid,uuid) from public;
grant execute on function public.seller_has_event_access(uuid,uuid) to authenticated;
grant execute on function public.draw_operator_has_event_access(uuid,uuid) to authenticated;

-- Convite vendedor: aceita mesmo se a conta também for organizadora ou operadora.
create or replace function public.accept_seller_invitation(invite_token uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare i public.seller_invitations%rowtype;current_email text;ev uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select lower(email) into current_email from auth.users where id=auth.uid();
  select * into i from public.seller_invitations where token=invite_token for update;
  if i.id is null then raise exception 'invite not found'; end if;
  if i.status<>'pending' or i.expires_at<=now() then raise exception 'invite is no longer valid'; end if;
  if current_email is distinct from lower(i.email) then raise exception 'invite belongs to another email'; end if;
  insert into public.workspace_operational_memberships(workspace_id,user_id,role,status) values(i.workspace_id,auth.uid(),'seller','active')
  on conflict(workspace_id,user_id,role) do update set status='active',updated_at=now();
  foreach ev in array coalesce(i.event_ids,'{}'::uuid[]) loop
    insert into public.event_seller_assignments(workspace_id,event_id,seller_user_id,is_active) values(i.workspace_id,ev,auth.uid(),true)
    on conflict(event_id,seller_user_id) do update set is_active=true,updated_at=now();
  end loop;
  update public.seller_invitations set status='accepted',accepted_by=auth.uid(),accepted_at=now() where id=i.id;
  insert into public.audit_logs(workspace_id,actor_user_id,action,entity_type,entity_id,metadata) values(i.workspace_id,auth.uid(),'seller.invite_accepted','operational_membership',auth.uid()::text,jsonb_build_object('event_ids',i.event_ids));
  return i.workspace_id;
end; $$;
revoke all on function public.accept_seller_invitation(uuid) from public;grant execute on function public.accept_seller_invitation(uuid) to authenticated;

create or replace function public.accept_draw_operator_invitation(invite_token uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare i public.draw_operator_invitations%rowtype;current_email text;ev uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select lower(email) into current_email from auth.users where id=auth.uid();
  select * into i from public.draw_operator_invitations where token=invite_token for update;
  if i.id is null then raise exception 'invite not found'; end if;
  if i.status<>'pending' or i.expires_at<=now() then raise exception 'invite is no longer valid'; end if;
  if current_email is distinct from lower(i.email) then raise exception 'invite belongs to another email'; end if;
  insert into public.workspace_operational_memberships(workspace_id,user_id,role,status) values(i.workspace_id,auth.uid(),'draw_operator','active')
  on conflict(workspace_id,user_id,role) do update set status='active',updated_at=now();
  foreach ev in array coalesce(i.event_ids,'{}'::uuid[]) loop
    insert into public.event_draw_operator_assignments(workspace_id,event_id,operator_user_id,is_active) values(i.workspace_id,ev,auth.uid(),true)
    on conflict(event_id,operator_user_id) do update set is_active=true,updated_at=now();
  end loop;
  update public.draw_operator_invitations set status='accepted',accepted_by=auth.uid(),accepted_at=now() where id=i.id;
  insert into public.audit_logs(workspace_id,actor_user_id,action,entity_type,entity_id,metadata) values(i.workspace_id,auth.uid(),'draw_operator.invite_accepted','operational_membership',auth.uid()::text,jsonb_build_object('event_ids',i.event_ids));
  return i.workspace_id;
end; $$;
revoke all on function public.accept_draw_operator_invitation(uuid) from public;grant execute on function public.accept_draw_operator_invitation(uuid) to authenticated;

create or replace function public.set_seller_event_assignments(target_workspace_id uuid,target_seller_user_id uuid,target_event_ids uuid[])
returns void language plpgsql security definer set search_path=public as $$
declare ev uuid;
begin
  if not public.has_workspace_role(target_workspace_id,array['organizer_owner','organizer_admin']::public.workspace_role[]) then raise exception 'access denied'; end if;
  insert into public.workspace_operational_memberships(workspace_id,user_id,role,status) values(target_workspace_id,target_seller_user_id,'seller','active') on conflict(workspace_id,user_id,role) do update set status='active',updated_at=now();
  if exists(select 1 from unnest(coalesce(target_event_ids,'{}'::uuid[])) e_id where not exists(select 1 from public.events e where e.id=e_id and e.workspace_id=target_workspace_id)) then raise exception 'invalid event assignment'; end if;
  update public.event_seller_assignments set is_active=false,updated_at=now() where workspace_id=target_workspace_id and seller_user_id=target_seller_user_id;
  foreach ev in array coalesce(target_event_ids,'{}'::uuid[]) loop insert into public.event_seller_assignments(workspace_id,event_id,seller_user_id,is_active) values(target_workspace_id,ev,target_seller_user_id,true) on conflict(event_id,seller_user_id) do update set is_active=true,updated_at=now(); end loop;
end; $$;
revoke all on function public.set_seller_event_assignments(uuid,uuid,uuid[]) from public;grant execute on function public.set_seller_event_assignments(uuid,uuid,uuid[]) to authenticated;

create or replace function public.set_draw_operator_event_assignments(target_workspace_id uuid,target_operator_user_id uuid,target_event_ids uuid[])
returns void language plpgsql security definer set search_path=public as $$
declare ev uuid;
begin
  if not public.has_workspace_role(target_workspace_id,array['organizer_owner','organizer_admin']::public.workspace_role[]) then raise exception 'access denied'; end if;
  insert into public.workspace_operational_memberships(workspace_id,user_id,role,status) values(target_workspace_id,target_operator_user_id,'draw_operator','active') on conflict(workspace_id,user_id,role) do update set status='active',updated_at=now();
  if exists(select 1 from unnest(coalesce(target_event_ids,'{}'::uuid[])) e_id where not exists(select 1 from public.events e where e.id=e_id and e.workspace_id=target_workspace_id)) then raise exception 'invalid event assignment'; end if;
  update public.event_draw_operator_assignments set is_active=false,updated_at=now() where workspace_id=target_workspace_id and operator_user_id=target_operator_user_id;
  foreach ev in array coalesce(target_event_ids,'{}'::uuid[]) loop insert into public.event_draw_operator_assignments(workspace_id,event_id,operator_user_id,is_active) values(target_workspace_id,ev,target_operator_user_id,true) on conflict(event_id,operator_user_id) do update set is_active=true,updated_at=now(); end loop;
end; $$;
revoke all on function public.set_draw_operator_event_assignments(uuid,uuid,uuid[]) from public;grant execute on function public.set_draw_operator_event_assignments(uuid,uuid,uuid[]) to authenticated;

create or replace function public.set_seller_membership_status(target_workspace_id uuid,target_seller_user_id uuid,target_status public.membership_status)
returns void language plpgsql security definer set search_path=public as $$ begin
  if not public.has_workspace_role(target_workspace_id,array['organizer_owner','organizer_admin']::public.workspace_role[]) then raise exception 'access denied'; end if;
  update public.workspace_operational_memberships set status=target_status,updated_at=now() where workspace_id=target_workspace_id and user_id=target_seller_user_id and role='seller';
  if not found then raise exception 'seller not found'; end if;
  if target_status<>'active' then update public.event_seller_assignments set is_active=false,updated_at=now() where workspace_id=target_workspace_id and seller_user_id=target_seller_user_id; end if;
end; $$;
revoke all on function public.set_seller_membership_status(uuid,uuid,public.membership_status) from public;grant execute on function public.set_seller_membership_status(uuid,uuid,public.membership_status) to authenticated;

create or replace function public.set_draw_operator_membership_status(target_workspace_id uuid,target_operator_user_id uuid,target_status public.membership_status)
returns void language plpgsql security definer set search_path=public as $$ begin
  if not public.has_workspace_role(target_workspace_id,array['organizer_owner','organizer_admin']::public.workspace_role[]) then raise exception 'access denied'; end if;
  update public.workspace_operational_memberships set status=target_status,updated_at=now() where workspace_id=target_workspace_id and user_id=target_operator_user_id and role='draw_operator';
  if not found then raise exception 'operator not found'; end if;
  if target_status<>'active' then update public.event_draw_operator_assignments set is_active=false,updated_at=now() where workspace_id=target_workspace_id and operator_user_id=target_operator_user_id; end if;
end; $$;
revoke all on function public.set_draw_operator_membership_status(uuid,uuid,public.membership_status) from public;grant execute on function public.set_draw_operator_membership_status(uuid,uuid,public.membership_status) to authenticated;

create or replace function public.list_seller_team(target_workspace_id uuid)
returns table(user_id uuid,display_name text,email text,status public.membership_status,event_ids uuid[],completed_sales bigint,completed_amount numeric)
language sql stable security definer set search_path=public as $$
  select m.user_id,p.display_name,u.email,m.status,coalesce((select array_agg(a.event_id order by a.event_id) from public.event_seller_assignments a where a.workspace_id=m.workspace_id and a.seller_user_id=m.user_id and a.is_active),'{}'::uuid[]),(select count(*) from public.sales s where s.workspace_id=m.workspace_id and s.seller_user_id=m.user_id and s.status='completed'),coalesce((select sum(s.total_amount) from public.sales s where s.workspace_id=m.workspace_id and s.seller_user_id=m.user_id and s.status='completed'),0)
  from public.workspace_operational_memberships m left join public.profiles p on p.id=m.user_id left join auth.users u on u.id=m.user_id
  where m.workspace_id=target_workspace_id and m.role='seller' and public.has_workspace_role(target_workspace_id,array['organizer_owner','organizer_admin']::public.workspace_role[])
  order by coalesce(p.display_name,u.email);
$$;
revoke all on function public.list_seller_team(uuid) from public;grant execute on function public.list_seller_team(uuid) to authenticated;

create or replace function public.list_draw_operator_team(target_workspace_id uuid)
returns table(user_id uuid,display_name text,email text,status public.membership_status,event_ids uuid[])
language sql stable security definer set search_path=public as $$
  select m.user_id,p.display_name,u.email,m.status,coalesce((select array_agg(a.event_id order by a.event_id) from public.event_draw_operator_assignments a where a.workspace_id=m.workspace_id and a.operator_user_id=m.user_id and a.is_active),'{}'::uuid[])
  from public.workspace_operational_memberships m left join public.profiles p on p.id=m.user_id left join auth.users u on u.id=m.user_id
  where m.workspace_id=target_workspace_id and m.role='draw_operator' and public.has_workspace_role(target_workspace_id,array['organizer_owner','organizer_admin']::public.workspace_role[])
  order by coalesce(p.display_name,u.email);
$$;
revoke all on function public.list_draw_operator_team(uuid) from public;grant execute on function public.list_draw_operator_team(uuid) to authenticated;

create or replace function public.list_my_access_centers()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare my_email text;begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select lower(email) into my_email from auth.users where id=auth.uid();
  return jsonb_build_object(
    'is_master',public.is_platform_owner(),
    'organizers',coalesce((select jsonb_agg(jsonb_build_object('workspace_id',w.id,'workspace_name',w.name,'role',wm.role::text) order by w.name) from public.workspace_members wm join public.workspaces w on w.id=wm.workspace_id where wm.user_id=auth.uid() and wm.status='active' and wm.role::text in ('organizer_owner','organizer_admin','event_manager') and w.is_active),'[]'::jsonb),
    'seller_events',coalesce((select jsonb_agg(jsonb_build_object('workspace_id',w.id,'workspace_name',w.name,'event_id',e.id,'event_name',e.name,'status',e.status,'starts_at',e.starts_at) order by e.starts_at nulls last,e.name) from public.event_seller_assignments a join public.workspace_operational_memberships m on m.workspace_id=a.workspace_id and m.user_id=a.seller_user_id and m.role='seller' join public.events e on e.id=a.event_id join public.workspaces w on w.id=a.workspace_id where a.seller_user_id=auth.uid() and a.is_active and m.status='active' and w.is_active and public.workspace_license_active(w.id)),'[]'::jsonb),
    'operator_events',coalesce((select jsonb_agg(jsonb_build_object('workspace_id',w.id,'workspace_name',w.name,'event_id',e.id,'event_name',e.name,'status',e.status,'starts_at',e.starts_at) order by e.starts_at nulls last,e.name) from public.event_draw_operator_assignments a join public.workspace_operational_memberships m on m.workspace_id=a.workspace_id and m.user_id=a.operator_user_id and m.role='draw_operator' join public.events e on e.id=a.event_id join public.workspaces w on w.id=a.workspace_id where a.operator_user_id=auth.uid() and a.is_active and m.status='active' and w.is_active and public.workspace_license_active(w.id)),'[]'::jsonb),
    'buyer_events',coalesce((select jsonb_agg(x.obj order by x.starts_at nulls last,x.event_name) from (select e.id as event_id,e.name event_name,e.starts_at,jsonb_build_object('event_id',e.id,'event_name',e.name,'status',e.status,'starts_at',e.starts_at,'organizer_name',w.name,'cards',count(distinct si.physical_card_id)) obj from public.sales s join public.sale_items si on si.sale_id=s.id and si.status='active' join public.physical_cards pc on pc.id=si.physical_card_id and pc.status='sold' join public.events e on e.id=s.event_id join public.workspaces w on w.id=s.workspace_id where s.status='completed' and lower(coalesce(s.buyer_email,''))=my_email group by e.id,e.name,e.status,e.starts_at,w.name)x),'[]'::jsonb)
  );
end; $$;
revoke all on function public.list_my_access_centers() from public;grant execute on function public.list_my_access_centers() to authenticated;

create or replace function public.get_my_buyer_event(target_event_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare my_email text;draw_token uuid;event_row public.events%rowtype;win_count int;winner_names text[];latest_session_id uuid;latest_prize text;my_latest_winners int:=0;total_latest_winners int:=0;buyer_label text;begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select lower(email) into my_email from auth.users where id=auth.uid();
  if not exists(select 1 from public.sales s join public.sale_items si on si.sale_id=s.id and si.status='active' join public.physical_cards pc on pc.id=si.physical_card_id and pc.status='sold' where s.event_id=target_event_id and s.status='completed' and lower(coalesce(s.buyer_email,''))=my_email) then raise exception 'buyer access denied'; end if;
  select * into event_row from public.events where id=target_event_id;
  select ds.public_token into draw_token from public.draw_sessions ds where ds.event_id=target_event_id order by case when ds.status in ('active','paused') then 0 else 1 end,ds.session_number desc limit 1;
  select count(*),coalesce(array_agg(distinct ds.name),'{}'::text[]) into win_count,winner_names from public.winners wi join public.draw_sessions ds on ds.id=wi.session_id join public.physical_cards pc on pc.id=wi.physical_card_id join public.sale_items si on si.physical_card_id=pc.id and si.status='active' join public.sales s on s.id=si.sale_id and s.status='completed' where wi.event_id=target_event_id and lower(coalesce(s.buyer_email,''))=my_email;
  select wi.session_id,ds.name into latest_session_id,latest_prize from public.winners wi join public.draw_sessions ds on ds.id=wi.session_id join public.sale_items si on si.physical_card_id=wi.physical_card_id and si.status='active' join public.sales s on s.id=si.sale_id and s.status='completed' where wi.event_id=target_event_id and lower(coalesce(s.buyer_email,''))=my_email order by wi.confirmed_at desc limit 1;
  if latest_session_id is not null then
    select count(*) into total_latest_winners from public.winners where session_id=latest_session_id;
    select count(*) into my_latest_winners from public.winners wi join public.sale_items si on si.physical_card_id=wi.physical_card_id and si.status='active' join public.sales s on s.id=si.sale_id and s.status='completed' where wi.session_id=latest_session_id and lower(coalesce(s.buyer_email,''))=my_email;
  end if;
  select nullif(trim(s.buyer_name),'') into buyer_label from public.sales s where s.event_id=target_event_id and s.status='completed' and lower(coalesce(s.buyer_email,''))=my_email and nullif(trim(s.buyer_name),'') is not null order by s.completed_at desc nulls last limit 1;
  return jsonb_build_object('event',jsonb_build_object('id',event_row.id,'name',event_row.name,'status',event_row.status),'public_session_token',draw_token,'winner_count',win_count,'winner_prizes',to_jsonb(winner_names),'latest_win',case when latest_session_id is null then null else jsonb_build_object('prize',latest_prize,'my_winners',my_latest_winners,'total_winners',total_latest_winners,'buyer_name',buyer_label) end,'cards',coalesce((select jsonb_agg(jsonb_build_object('id',pc.id,'code',pc.code,'public_token',pc.public_token,'physical_format',pc.physical_format,'buyer_name',s.buyer_name) order by pc.sequence_number) from public.sales s join public.sale_items si on si.sale_id=s.id and si.status='active' join public.physical_cards pc on pc.id=si.physical_card_id and pc.status='sold' where s.event_id=target_event_id and s.status='completed' and lower(coalesce(s.buyer_email,''))=my_email),'[]'::jsonb));
end; $$;
revoke all on function public.get_my_buyer_event(uuid) from public;grant execute on function public.get_my_buyer_event(uuid) to authenticated;
