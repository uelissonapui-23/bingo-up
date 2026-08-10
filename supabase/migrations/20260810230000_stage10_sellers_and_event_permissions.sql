-- Etapa 10: vendedores com login, convite, vínculo por evento e vendas isoladas.

create table if not exists public.seller_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  token uuid not null default gen_random_uuid() unique,
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  event_ids uuid[] not null default '{}'::uuid[],
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists seller_invitations_workspace_idx on public.seller_invitations(workspace_id,created_at desc);
create index if not exists seller_invitations_email_idx on public.seller_invitations(lower(email),status);

create table if not exists public.event_seller_assignments (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  seller_user_id uuid not null references auth.users(id) on delete cascade,
  is_active boolean not null default true,
  assigned_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(event_id,seller_user_id)
);
create index if not exists event_seller_assignments_user_idx on public.event_seller_assignments(seller_user_id,is_active,event_id);
create index if not exists event_seller_assignments_workspace_idx on public.event_seller_assignments(workspace_id,event_id,is_active);

alter table public.seller_invitations enable row level security;
alter table public.event_seller_assignments enable row level security;

create or replace function public.seller_has_event_access(target_event_id uuid, target_user_id uuid default auth.uid())
returns boolean
language sql stable security definer set search_path=public
as $$
  select public.is_platform_admin() or exists(
    select 1
    from public.event_seller_assignments a
    join public.workspace_members wm on wm.workspace_id=a.workspace_id and wm.user_id=a.seller_user_id
    where a.event_id=target_event_id
      and a.seller_user_id=target_user_id
      and a.is_active
      and wm.status='active'
      and wm.role='seller'
  );
$$;
revoke all on function public.seller_has_event_access(uuid,uuid) from public;
grant execute on function public.seller_has_event_access(uuid,uuid) to authenticated;

create policy seller_invitations_admin_read on public.seller_invitations for select to authenticated
using(public.has_workspace_role(workspace_id,array['organizer_owner','organizer_admin']::public.workspace_role[]));
create policy event_seller_assignments_admin_read on public.event_seller_assignments for select to authenticated
using(public.has_workspace_role(workspace_id,array['organizer_owner','organizer_admin']::public.workspace_role[]) or seller_user_id=auth.uid());

-- O vendedor só enxerga eventos explicitamente atribuídos. Organizadores preservam o acesso atual.
drop policy if exists events_member_select on public.events;
create policy events_member_select on public.events for select to authenticated
using(
  public.has_workspace_role(workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[])
  or public.seller_has_event_access(id)
);

drop policy if exists event_settings_member_select on public.event_settings;
create policy event_settings_member_select on public.event_settings for select to authenticated
using(
  public.has_workspace_role(workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[])
  or public.seller_has_event_access(event_id)
);

drop policy if exists card_batches_member_select on public.card_batches;
create policy card_batches_member_select on public.card_batches for select to authenticated
using(
  public.has_workspace_role(workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[])
  or public.seller_has_event_access(event_id)
);

drop policy if exists physical_cards_member_select on public.physical_cards;
create policy physical_cards_member_select on public.physical_cards for select to authenticated
using(
  public.has_workspace_role(workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[])
  or public.seller_has_event_access(event_id)
);

-- Vendedores não precisam ler motor, jogos, sorteio e conferência diretamente.
drop policy if exists game_definitions_member_select on public.game_definitions;
create policy game_definitions_member_select on public.game_definitions for select to authenticated
using(public.has_workspace_role(workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]));
drop policy if exists card_games_member_select on public.card_games;
create policy card_games_member_select on public.card_games for select to authenticated
using(public.has_workspace_role(workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]));

do $$ begin
  if exists(select 1 from pg_policies where schemaname='public' and tablename='bingo_rule_sets' and policyname='bingo_rule_sets_member_select') then
    execute 'drop policy bingo_rule_sets_member_select on public.bingo_rule_sets';
  end if;
exception when undefined_table then null; end $$;
do $$ begin
  if exists(select 1 from pg_policies where schemaname='public' and tablename='card_templates' and policyname='card_templates_member_select') then
    execute 'drop policy card_templates_member_select on public.card_templates';
  end if;
exception when undefined_table then null; end $$;
create policy bingo_rule_sets_member_select on public.bingo_rule_sets for select to authenticated
using(public.has_workspace_role(workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]));
create policy card_templates_member_select on public.card_templates for select to authenticated
using(public.has_workspace_role(workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]));

-- Seller não deve listar toda a equipe do workspace.
drop policy if exists workspace_members_select_same_workspace on public.workspace_members;
create policy workspace_members_select_self_or_admin on public.workspace_members for select to authenticated
using(user_id=auth.uid() or public.has_workspace_role(workspace_id,array['organizer_owner','organizer_admin']::public.workspace_role[]));

create or replace function public.create_seller_invitation(target_workspace_id uuid,target_email text,target_event_ids uuid[] default '{}'::uuid[])
returns uuid
language plpgsql security definer set search_path=public
as $$
declare clean_email text:=lower(trim(target_email)); invite_token uuid;
begin
  if not public.has_workspace_role(target_workspace_id,array['organizer_owner','organizer_admin']::public.workspace_role[]) then raise exception 'access denied'; end if;
  if clean_email='' or position('@' in clean_email)=0 then raise exception 'invalid email'; end if;
  if exists(select 1 from unnest(coalesce(target_event_ids,'{}'::uuid[])) e_id where not exists(select 1 from public.events e where e.id=e_id and e.workspace_id=target_workspace_id)) then raise exception 'invalid event assignment'; end if;
  update public.seller_invitations set status='revoked' where workspace_id=target_workspace_id and lower(email)=clean_email and status='pending';
  insert into public.seller_invitations(workspace_id,email,event_ids) values(target_workspace_id,clean_email,coalesce(target_event_ids,'{}'::uuid[])) returning token into invite_token;
  perform public.log_audit(target_workspace_id,'seller.invited','seller_invitation',invite_token::text,jsonb_build_object('email',clean_email,'event_ids',target_event_ids));
  return invite_token;
end; $$;
revoke all on function public.create_seller_invitation(uuid,text,uuid[]) from public;
grant execute on function public.create_seller_invitation(uuid,text,uuid[]) to authenticated;

create or replace function public.get_seller_invitation(invite_token uuid)
returns table(workspace_name text,email text,expires_at timestamptz,status text,event_names text[])
language sql stable security definer set search_path=public
as $$
  select w.name,i.email,i.expires_at,
    case when i.status='pending' and i.expires_at<=now() then 'expired' else i.status end,
    coalesce((select array_agg(e.name order by e.starts_at nulls last,e.name) from public.events e where e.id=any(i.event_ids)), '{}'::text[])
  from public.seller_invitations i join public.workspaces w on w.id=i.workspace_id
  where i.token=invite_token;
$$;
revoke all on function public.get_seller_invitation(uuid) from public;
grant execute on function public.get_seller_invitation(uuid) to authenticated;

create or replace function public.accept_seller_invitation(invite_token uuid)
returns uuid
language plpgsql security definer set search_path=public
as $$
declare i public.seller_invitations%rowtype; current_email text; ev uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select lower(email) into current_email from auth.users where id=auth.uid();
  select * into i from public.seller_invitations where token=invite_token for update;
  if i.id is null then raise exception 'invite not found'; end if;
  if i.status<>'pending' or i.expires_at<=now() then raise exception 'invite is no longer valid'; end if;
  if current_email is distinct from lower(i.email) then raise exception 'invite belongs to another email'; end if;
  if exists(select 1 from public.workspace_members where workspace_id=i.workspace_id and user_id=auth.uid() and role<>'seller') then raise exception 'this account already has an organizer role in this workspace'; end if;
  insert into public.workspace_members(workspace_id,user_id,role,status)
  values(i.workspace_id,auth.uid(),'seller','active')
  on conflict(workspace_id,user_id) do update set role='seller',status='active',updated_at=now();
  foreach ev in array i.event_ids loop
    insert into public.event_seller_assignments(workspace_id,event_id,seller_user_id,is_active)
    values(i.workspace_id,ev,auth.uid(),true)
    on conflict(event_id,seller_user_id) do update set is_active=true,updated_at=now();
  end loop;
  update public.seller_invitations set status='accepted',accepted_by=auth.uid(),accepted_at=now() where id=i.id;
  insert into public.audit_logs(workspace_id,actor_user_id,action,entity_type,entity_id,metadata)
  values(i.workspace_id,auth.uid(),'seller.invite_accepted','workspace_member',auth.uid()::text,jsonb_build_object('event_ids',i.event_ids));
  return i.workspace_id;
end; $$;
revoke all on function public.accept_seller_invitation(uuid) from public;
grant execute on function public.accept_seller_invitation(uuid) to authenticated;

create or replace function public.set_seller_event_assignments(target_workspace_id uuid,target_seller_user_id uuid,target_event_ids uuid[])
returns void
language plpgsql security definer set search_path=public
as $$
declare ev uuid;
begin
  if not public.has_workspace_role(target_workspace_id,array['organizer_owner','organizer_admin']::public.workspace_role[]) then raise exception 'access denied'; end if;
  if not exists(select 1 from public.workspace_members where workspace_id=target_workspace_id and user_id=target_seller_user_id and role='seller' and status='active') then raise exception 'seller not active'; end if;
  if exists(select 1 from unnest(coalesce(target_event_ids,'{}'::uuid[])) e_id where not exists(select 1 from public.events e where e.id=e_id and e.workspace_id=target_workspace_id)) then raise exception 'invalid event assignment'; end if;
  update public.event_seller_assignments set is_active=false,updated_at=now() where workspace_id=target_workspace_id and seller_user_id=target_seller_user_id;
  foreach ev in array coalesce(target_event_ids,'{}'::uuid[]) loop
    insert into public.event_seller_assignments(workspace_id,event_id,seller_user_id,is_active)
    values(target_workspace_id,ev,target_seller_user_id,true)
    on conflict(event_id,seller_user_id) do update set is_active=true,updated_at=now();
  end loop;
  perform public.log_audit(target_workspace_id,'seller.assignments_updated','workspace_member',target_seller_user_id::text,jsonb_build_object('event_ids',target_event_ids));
end; $$;
revoke all on function public.set_seller_event_assignments(uuid,uuid,uuid[]) from public;
grant execute on function public.set_seller_event_assignments(uuid,uuid,uuid[]) to authenticated;

create or replace function public.set_seller_membership_status(target_workspace_id uuid,target_seller_user_id uuid,target_status public.membership_status)
returns void
language plpgsql security definer set search_path=public
as $$
begin
  if not public.has_workspace_role(target_workspace_id,array['organizer_owner','organizer_admin']::public.workspace_role[]) then raise exception 'access denied'; end if;
  if target_status not in ('active','suspended','revoked') then raise exception 'invalid seller status'; end if;
  update public.workspace_members set status=target_status,updated_at=now()
  where workspace_id=target_workspace_id and user_id=target_seller_user_id and role='seller';
  if not found then raise exception 'seller not found'; end if;
  if target_status<>'active' then update public.event_seller_assignments set is_active=false,updated_at=now() where workspace_id=target_workspace_id and seller_user_id=target_seller_user_id; end if;
  perform public.log_audit(target_workspace_id,'seller.status_changed','workspace_member',target_seller_user_id::text,jsonb_build_object('status',target_status));
end; $$;
revoke all on function public.set_seller_membership_status(uuid,uuid,public.membership_status) from public;
grant execute on function public.set_seller_membership_status(uuid,uuid,public.membership_status) to authenticated;

create or replace function public.list_seller_team(target_workspace_id uuid)
returns table(user_id uuid,display_name text,email text,status public.membership_status,event_ids uuid[],completed_sales bigint,completed_amount numeric)
language sql stable security definer set search_path=public
as $$
  select wm.user_id,p.display_name,u.email,wm.status,
    coalesce((select array_agg(a.event_id order by a.event_id) from public.event_seller_assignments a where a.workspace_id=wm.workspace_id and a.seller_user_id=wm.user_id and a.is_active),'{}'::uuid[]),
    (select count(*) from public.sales s where s.workspace_id=wm.workspace_id and s.seller_user_id=wm.user_id and s.status='completed'),
    coalesce((select sum(s.total_amount) from public.sales s where s.workspace_id=wm.workspace_id and s.seller_user_id=wm.user_id and s.status='completed'),0)
  from public.workspace_members wm
  left join public.profiles p on p.id=wm.user_id
  left join auth.users u on u.id=wm.user_id
  where wm.workspace_id=target_workspace_id and wm.role='seller'
    and public.has_workspace_role(target_workspace_id,array['organizer_owner','organizer_admin']::public.workspace_role[])
  order by coalesce(p.display_name,u.email);
$$;
revoke all on function public.list_seller_team(uuid) from public;
grant execute on function public.list_seller_team(uuid) to authenticated;

-- Libera venda exclusivamente nos eventos atribuídos ao vendedor.
create or replace function public.create_card_sale(
  target_event_id uuid,target_card_ids uuid[],buyer_name text default null,buyer_phone text default null,buyer_email text default null,buyer_notes text default null,unit_price numeric default null,reserve_only boolean default false
) returns uuid
language plpgsql security definer set search_path=public as $$
declare e public.events%rowtype; s public.event_settings%rowtype; sale_id uuid; card_count integer; effective_price numeric(12,2); expires_at timestamptz; target_status public.sale_status; seller_mode boolean;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if target_card_ids is null or cardinality(target_card_ids)=0 then raise exception 'at least one card required'; end if;
  if cardinality(target_card_ids)>500 then raise exception 'maximum 500 cards per operation'; end if;
  if cardinality(target_card_ids)<>(select count(distinct x) from unnest(target_card_ids)x) then raise exception 'duplicate card ids'; end if;
  select * into e from public.events where id=target_event_id for share;
  if e.id is null then raise exception 'event not found'; end if;
  seller_mode:=public.seller_has_event_access(e.id);
  if not seller_mode and not public.has_workspace_role(e.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) then raise exception 'access denied'; end if;
  if e.status in ('sales_paused','drawing','paused','finished','canceled','archived') then raise exception 'sales are not allowed for this event status'; end if;
  select * into s from public.event_settings where event_id=e.id;
  if reserve_only and not s.allow_reservations then raise exception 'reservations disabled'; end if;
  perform public._validate_buyer_fields(e.id,buyer_name,buyer_phone,buyer_email);
  perform public.expire_event_reservations(e.id);
  perform 1 from public.physical_cards where id=any(target_card_ids) and workspace_id=e.workspace_id and event_id=e.id order by id for update;
  select count(*) into card_count from public.physical_cards where id=any(target_card_ids) and workspace_id=e.workspace_id and event_id=e.id and status='available';
  if card_count<>cardinality(target_card_ids) then raise exception 'one or more cards are no longer available'; end if;
  effective_price:=round(coalesce(unit_price,s.default_card_price)::numeric,2); if effective_price<0 then raise exception 'invalid price'; end if;
  target_status:=case when reserve_only then 'reserved'::public.sale_status else 'completed'::public.sale_status end;
  expires_at:=case when reserve_only then now()+make_interval(mins=>greatest(1,s.reservation_minutes)) else null end;
  insert into public.sales(workspace_id,event_id,status,channel,seller_user_id,buyer_name,buyer_phone,buyer_email,buyer_notes,currency,total_amount,reservation_expires_at,completed_at)
  values(e.workspace_id,e.id,target_status,case when seller_mode then 'seller'::public.sale_channel else 'organizer'::public.sale_channel end,auth.uid(),nullif(trim(buyer_name),''),nullif(trim(buyer_phone),''),nullif(trim(buyer_email),''),nullif(trim(buyer_notes),''),s.currency,effective_price*card_count,expires_at,case when reserve_only then null else now() end) returning id into sale_id;
  insert into public.sale_items(workspace_id,event_id,sale_id,physical_card_id,unit_price) select e.workspace_id,e.id,sale_id,id,effective_price from public.physical_cards where id=any(target_card_ids);
  if reserve_only then update public.physical_cards set status='reserved',current_sale_id=sale_id,reserved_at=now(),reserved_by_user_id=auth.uid(),reservation_expires_at=expires_at where id=any(target_card_ids);
  else update public.physical_cards set status='sold',current_sale_id=sale_id,sold_at=now(),sold_by_user_id=auth.uid(),reserved_at=null,reserved_by_user_id=null,reservation_expires_at=null where id=any(target_card_ids); end if;
  insert into public.audit_logs(workspace_id,actor_user_id,action,entity_type,entity_id,metadata) values(e.workspace_id,auth.uid(),case when reserve_only then 'sale.reserved' else 'sale.completed' end,'sale',sale_id::text,jsonb_build_object('event_id',e.id,'card_count',card_count,'channel',case when seller_mode then 'seller' else 'organizer' end));
  return sale_id;
end; $$;
revoke all on function public.create_card_sale(uuid,uuid[],text,text,text,text,numeric,boolean) from public;
grant execute on function public.create_card_sale(uuid,uuid[],text,text,text,text,numeric,boolean) to authenticated;

create or replace function public.complete_reserved_sale(target_sale_id uuid) returns void
language plpgsql security definer set search_path=public as $$
declare sa public.sales%rowtype; active_count integer; seller_mode boolean;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into sa from public.sales where id=target_sale_id for update; if sa.id is null then raise exception 'sale not found'; end if;
  seller_mode:=sa.seller_user_id=auth.uid() and public.seller_has_event_access(sa.event_id);
  if not seller_mode and not public.has_workspace_role(sa.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) then raise exception 'access denied'; end if;
  if sa.status<>'reserved' then raise exception 'sale is not reserved'; end if;
  if sa.reservation_expires_at is not null and sa.reservation_expires_at<=now() then perform public.expire_event_reservations(sa.event_id); raise exception 'reservation expired'; end if;
  select count(*) into active_count from public.sale_items where sale_id=sa.id and status='active'; if active_count=0 then raise exception 'sale has no active cards'; end if;
  update public.physical_cards set status='sold',sold_at=now(),sold_by_user_id=auth.uid(),reserved_at=null,reserved_by_user_id=null,reservation_expires_at=null where current_sale_id=sa.id and status='reserved';
  update public.sales set status='completed',completed_at=now(),reservation_expires_at=null,updated_at=now() where id=sa.id;
  insert into public.audit_logs(workspace_id,actor_user_id,action,entity_type,entity_id,metadata) values(sa.workspace_id,auth.uid(),'sale.completed','sale',sa.id::text,jsonb_build_object('event_id',sa.event_id,'from_reservation',true));
end; $$;

create or replace function public.cancel_sale(target_sale_id uuid,reason text default null) returns void
language plpgsql security definer set search_path=public as $$
declare sa public.sales%rowtype; e public.events%rowtype; seller_mode boolean;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into sa from public.sales where id=target_sale_id for update; if sa.id is null then raise exception 'sale not found'; end if;
  seller_mode:=sa.seller_user_id=auth.uid() and public.seller_has_event_access(sa.event_id);
  if not seller_mode and not public.has_workspace_role(sa.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) then raise exception 'access denied'; end if;
  if sa.status='canceled' then raise exception 'sale already canceled'; end if;
  select * into e from public.events where id=sa.event_id;
  if sa.status='completed' and e.status in ('drawing','paused','finished') then raise exception 'completed sales cannot be canceled after drawing starts'; end if;
  update public.sale_items set status='canceled',canceled_at=now() where sale_id=sa.id and status='active';
  update public.physical_cards set status='available',current_sale_id=null,sold_at=null,sold_by_user_id=null,reserved_at=null,reserved_by_user_id=null,reservation_expires_at=null where current_sale_id=sa.id and status in ('sold','reserved');
  update public.sales set status='canceled',canceled_at=now(),canceled_by=auth.uid(),cancel_reason=left(nullif(trim(reason),''),500),updated_at=now() where id=sa.id;
  insert into public.audit_logs(workspace_id,actor_user_id,action,entity_type,entity_id,metadata) values(sa.workspace_id,auth.uid(),'sale.canceled','sale',sa.id::text,jsonb_build_object('event_id',sa.event_id,'previous_status',sa.status,'reason',reason));
end; $$;

-- expiração pode ser chamada pelo vendedor somente em evento atribuído.
create or replace function public.expire_event_reservations(target_event_id uuid) returns integer
language plpgsql security definer set search_path=public as $$
declare e public.events%rowtype; released integer:=0; sale_row record;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into e from public.events where id=target_event_id; if e.id is null then raise exception 'event not found'; end if;
  if not public.seller_has_event_access(e.id) and not public.has_workspace_role(e.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) then raise exception 'access denied'; end if;
  for sale_row in select id from public.sales where event_id=e.id and status='reserved' and reservation_expires_at is not null and reservation_expires_at<=now() for update loop
    update public.sale_items set status='canceled',canceled_at=now() where sale_id=sale_row.id and status='active';
    update public.physical_cards set status='available',current_sale_id=null,reserved_at=null,reserved_by_user_id=null,reservation_expires_at=null where current_sale_id=sale_row.id and status='reserved';
    update public.sales set status='canceled',canceled_at=now(),cancel_reason='Reserva expirada automaticamente',updated_at=now() where id=sale_row.id;
    released:=released+1;
  end loop; return released;
end; $$;

-- Seller pode usar o último workspace normalmente.
create or replace function public.set_last_workspace(target_workspace_id uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from public.workspace_members where workspace_id=target_workspace_id and user_id=auth.uid() and status='active') and not public.is_platform_admin() then raise exception 'workspace access denied'; end if;
  insert into public.user_preferences(user_id,last_workspace_id) values(auth.uid(),target_workspace_id)
  on conflict(user_id) do update set last_workspace_id=excluded.last_workspace_id,updated_at=now();
end; $$;

create trigger event_seller_assignments_set_updated_at before update on public.event_seller_assignments for each row execute function public.set_updated_at();

-- Least privilege: vendedor não recebe dados de impressão, sorteio, progresso ou vencedores.
drop policy if exists card_print_jobs_member_select on public.card_print_jobs;
create policy card_print_jobs_member_select on public.card_print_jobs for select to authenticated
using(public.has_workspace_role(workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]));
drop policy if exists draw_sessions_member_select on public.draw_sessions;
create policy draw_sessions_member_select on public.draw_sessions for select to authenticated
using(public.has_workspace_role(workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]));
drop policy if exists draw_session_games_member_select on public.draw_session_games;
create policy draw_session_games_member_select on public.draw_session_games for select to authenticated
using(public.has_workspace_role(workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]));
drop policy if exists draw_numbers_member_select on public.draw_numbers;
create policy draw_numbers_member_select on public.draw_numbers for select to authenticated
using(public.has_workspace_role(workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]));
drop policy if exists game_progress_member_select on public.game_progress;
create policy game_progress_member_select on public.game_progress for select to authenticated
using(public.has_workspace_role(workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]));
drop policy if exists winner_candidates_member_select on public.winner_candidates;
create policy winner_candidates_member_select on public.winner_candidates for select to authenticated
using(public.has_workspace_role(workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]));
drop policy if exists winners_member_select on public.winners;
create policy winners_member_select on public.winners for select to authenticated
using(public.has_workspace_role(workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]));

-- Vendedor não herda visão administrativa do workspace.
drop policy if exists workspace_settings_member_read on public.workspace_settings;
create policy workspace_settings_member_read on public.workspace_settings for select to authenticated
using(public.has_workspace_role(workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]));
drop policy if exists subscriptions_workspace_read on public.subscriptions;
create policy subscriptions_workspace_read on public.subscriptions for select to authenticated
using(public.has_workspace_role(workspace_id,array['organizer_owner','organizer_admin']::public.workspace_role[]));
drop policy if exists usage_workspace_read on public.usage_counters;
create policy usage_workspace_read on public.usage_counters for select to authenticated
using(public.has_workspace_role(workspace_id,array['organizer_owner','organizer_admin']::public.workspace_role[]));

create or replace function public.shares_workspace_with(target_user_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select auth.uid()=target_user_id or public.is_platform_admin() or exists(
    select 1 from public.workspace_members mine
    join public.workspace_members theirs on theirs.workspace_id=mine.workspace_id
    where mine.user_id=auth.uid() and mine.status='active'
      and mine.role in ('organizer_owner','organizer_admin','event_manager')
      and theirs.user_id=target_user_id and theirs.status='active'
  );
$$;

create or replace function public.get_workspace_dashboard(target_workspace_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not public.has_workspace_role(target_workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) then raise exception 'access denied'; end if;
  select jsonb_build_object(
    'events_total',(select count(*) from public.events e where e.workspace_id=target_workspace_id and e.status<>'archived'),
    'events_active',(select count(*) from public.events e where e.workspace_id=target_workspace_id and e.status in ('sales_open','sales_paused','ready','drawing','paused')),
    'cards_issued',(select count(*) from public.physical_cards c where c.workspace_id=target_workspace_id and c.status<>'void'),
    'cards_sold',(select count(*) from public.physical_cards c where c.workspace_id=target_workspace_id and c.status='sold'),
    'sales_completed',(select count(*) from public.sales s where s.workspace_id=target_workspace_id and s.status='completed'),
    'sales_amount',coalesce((select sum(s.total_amount) from public.sales s where s.workspace_id=target_workspace_id and s.status='completed'),0),
    'draw_sessions',(select count(*) from public.draw_sessions d where d.workspace_id=target_workspace_id),
    'winners',(select count(*) from public.winners w where w.workspace_id=target_workspace_id),
    'recent_events',coalesce((select jsonb_agg(row_to_json(x)::jsonb order by x.created_at desc) from (
      select e.id,e.name,e.status,e.starts_at,e.created_at,
        (select count(*) from public.physical_cards c where c.event_id=e.id and c.status<>'void') cards_issued,
        (select count(*) from public.physical_cards c where c.event_id=e.id and c.status='sold') cards_sold,
        coalesce((select sum(s.total_amount) from public.sales s where s.event_id=e.id and s.status='completed'),0) sales_amount,
        (select count(*) from public.winners w where w.event_id=e.id) winners
      from public.events e where e.workspace_id=target_workspace_id and e.status<>'archived'
      order by coalesce(e.starts_at,e.created_at) desc limit 6
    )x),'[]'::jsonb)
  ) into result; return result;
end; $$;

create or replace function public.get_event_report(target_event_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare e public.events%rowtype; result jsonb;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into e from public.events where id=target_event_id; if e.id is null then raise exception 'event not found'; end if;
  if not public.has_workspace_role(e.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) then raise exception 'access denied'; end if;
  select jsonb_build_object(
    'event',jsonb_build_object('id',e.id,'name',e.name,'status',e.status,'starts_at',e.starts_at,'ends_at',e.ends_at),
    'cards',jsonb_build_object('issued',(select count(*) from public.physical_cards c where c.event_id=e.id and c.status<>'void'),'available',(select count(*) from public.physical_cards c where c.event_id=e.id and c.status='available'),'reserved',(select count(*) from public.physical_cards c where c.event_id=e.id and c.status='reserved'),'sold',(select count(*) from public.physical_cards c where c.event_id=e.id and c.status='sold'),'canceled',(select count(*) from public.physical_cards c where c.event_id=e.id and c.status in ('canceled','void'))),
    'sales',jsonb_build_object('completed',(select count(*) from public.sales s where s.event_id=e.id and s.status='completed'),'reserved',(select count(*) from public.sales s where s.event_id=e.id and s.status='reserved'),'canceled',(select count(*) from public.sales s where s.event_id=e.id and s.status='canceled'),'amount',coalesce((select sum(s.total_amount) from public.sales s where s.event_id=e.id and s.status='completed'),0),'average_ticket',coalesce((select avg(s.total_amount) from public.sales s where s.event_id=e.id and s.status='completed'),0)),
    'draws',jsonb_build_object('total',(select count(*) from public.draw_sessions d where d.event_id=e.id),'finished',(select count(*) from public.draw_sessions d where d.event_id=e.id and d.status='finished'),'called_numbers',coalesce((select sum(d.called_count) from public.draw_sessions d where d.event_id=e.id),0)),
    'winners',(select count(*) from public.winners w where w.event_id=e.id),
    'sessions',coalesce((select jsonb_agg(row_to_json(x)::jsonb order by x.session_number desc) from (select d.id,d.session_number,d.name,d.status,d.win_pattern_code,d.participant_cards,d.participant_games,d.called_count,d.started_at,d.finished_at,(select count(*) from public.winners w where w.session_id=d.id) winners from public.draw_sessions d where d.event_id=e.id order by d.session_number desc)x),'[]'::jsonb),
    'sales_by_day',coalesce((
      select jsonb_agg(row_to_json(x)::jsonb order by x.sale_date)
      from (
        select
          (s.completed_at at time zone 'UTC')::date as sale_date,
          count(*) as sales_count,
          sum(s.total_amount) as amount
        from public.sales s
        where s.event_id=e.id
          and s.status='completed'
          and s.completed_at is not null
        group by (s.completed_at at time zone 'UTC')::date
        order by (s.completed_at at time zone 'UTC')::date
      ) x
    ),'[]'::jsonb)
  ) into result; return result;
end; $$;
