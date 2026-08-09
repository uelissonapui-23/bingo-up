-- Fase 6: vendas básicas do organizador, reservas e trilha histórica.
-- Estrutura já preparada para seller_user_id e canais futuros, sem liberar o módulo de vendedores ainda.

create type public.sale_status as enum ('reserved','completed','canceled');
create type public.sale_item_status as enum ('active','canceled');
create type public.sale_channel as enum ('organizer','seller','online','import');

alter table public.physical_cards
  add column if not exists sold_at timestamptz,
  add column if not exists sold_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists current_sale_id uuid,
  add column if not exists reserved_at timestamptz,
  add column if not exists reserved_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists reservation_expires_at timestamptz;

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  status public.sale_status not null,
  channel public.sale_channel not null default 'organizer',
  seller_user_id uuid references auth.users(id) on delete set null,
  buyer_name text,
  buyer_phone text,
  buyer_email text,
  buyer_notes text,
  currency text not null default 'BRL',
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  reservation_expires_at timestamptz,
  completed_at timestamptz,
  canceled_at timestamptz,
  canceled_by uuid references auth.users(id) on delete set null,
  cancel_reason text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (buyer_email is null or length(buyer_email) <= 320),
  check (buyer_name is null or length(buyer_name) <= 200),
  check (buyer_phone is null or length(buyer_phone) <= 60),
  check (buyer_notes is null or length(buyer_notes) <= 1000)
);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  sale_id uuid not null references public.sales(id) on delete cascade,
  physical_card_id uuid not null references public.physical_cards(id) on delete restrict,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  status public.sale_item_status not null default 'active',
  canceled_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.physical_cards
  add constraint physical_cards_current_sale_fk foreign key (current_sale_id) references public.sales(id) on delete set null;

create unique index sale_items_one_active_per_card_idx on public.sale_items(physical_card_id) where status='active';
create index sales_event_created_idx on public.sales(workspace_id,event_id,created_at desc);
create index sales_event_status_idx on public.sales(workspace_id,event_id,status);
create index sales_seller_idx on public.sales(workspace_id,seller_user_id,created_at desc);
create index sale_items_sale_idx on public.sale_items(sale_id);
create index sale_items_event_idx on public.sale_items(workspace_id,event_id,physical_card_id);
create index physical_cards_sale_status_idx on public.physical_cards(workspace_id,event_id,status,sequence_number);
create index physical_cards_reservation_expiry_idx on public.physical_cards(event_id,reservation_expires_at) where status='reserved';

alter table public.sales enable row level security;
alter table public.sale_items enable row level security;

create policy sales_member_select on public.sales for select to authenticated
  using (public.has_workspace_role(workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) or seller_user_id=auth.uid());
create policy sale_items_member_select on public.sale_items for select to authenticated
  using (public.has_workspace_role(workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) or exists(select 1 from public.sales s where s.id=sale_id and s.seller_user_id=auth.uid()));

-- Escritas passam exclusivamente por RPCs transacionais para impedir venda dupla e manter cartão/venda sincronizados.

create or replace function public._validate_buyer_fields(
  target_event_id uuid,
  buyer_name text,
  buyer_phone text,
  buyer_email text
) returns void
language plpgsql security definer set search_path=public as $$
declare s public.event_settings%rowtype;
begin
  select * into s from public.event_settings where event_id=target_event_id;
  if s.event_id is null then raise exception 'event settings not found'; end if;
  if s.require_buyer_name and nullif(trim(coalesce(buyer_name,'')),'') is null then raise exception 'buyer name required'; end if;
  if s.require_buyer_phone and nullif(trim(coalesce(buyer_phone,'')),'') is null then raise exception 'buyer phone required'; end if;
  if s.require_buyer_email and nullif(trim(coalesce(buyer_email,'')),'') is null then raise exception 'buyer email required'; end if;
  if nullif(trim(coalesce(buyer_email,'')),'') is not null and position('@' in buyer_email)=0 then raise exception 'invalid buyer email'; end if;
end; $$;
revoke all on function public._validate_buyer_fields(uuid,text,text,text) from public;

create or replace function public.expire_event_reservations(target_event_id uuid) returns integer
language plpgsql security definer set search_path=public as $$
declare e public.events%rowtype; released integer := 0; sale_row record;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into e from public.events where id=target_event_id;
  if e.id is null then raise exception 'event not found'; end if;
  if not public.is_workspace_member(e.workspace_id) then raise exception 'access denied'; end if;

  for sale_row in
    select id from public.sales
    where event_id=e.id and status='reserved' and reservation_expires_at is not null and reservation_expires_at <= now()
    for update
  loop
    update public.sale_items set status='canceled',canceled_at=now() where sale_id=sale_row.id and status='active';
    update public.physical_cards set status='available',current_sale_id=null,reserved_at=null,reserved_by_user_id=null,reservation_expires_at=null
      where current_sale_id=sale_row.id and status='reserved';
    update public.sales set status='canceled',canceled_at=now(),cancel_reason='Reserva expirada automaticamente',updated_at=now() where id=sale_row.id;
    released := released + 1;
  end loop;
  return released;
end; $$;
revoke all on function public.expire_event_reservations(uuid) from public;
grant execute on function public.expire_event_reservations(uuid) to authenticated;

create or replace function public.create_card_sale(
  target_event_id uuid,
  target_card_ids uuid[],
  buyer_name text default null,
  buyer_phone text default null,
  buyer_email text default null,
  buyer_notes text default null,
  unit_price numeric default null,
  reserve_only boolean default false
) returns uuid
language plpgsql security definer set search_path=public as $$
declare
  e public.events%rowtype;
  s public.event_settings%rowtype;
  sale_id uuid;
  card_count integer;
  effective_price numeric(12,2);
  expires_at timestamptz;
  target_status public.sale_status;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if target_card_ids is null or cardinality(target_card_ids)=0 then raise exception 'at least one card required'; end if;
  if cardinality(target_card_ids)>500 then raise exception 'maximum 500 cards per operation'; end if;
  if cardinality(target_card_ids) <> (select count(distinct x) from unnest(target_card_ids) x) then raise exception 'duplicate card ids'; end if;

  select * into e from public.events where id=target_event_id for share;
  if e.id is null then raise exception 'event not found'; end if;
  if not public.has_workspace_role(e.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) then raise exception 'access denied'; end if;
  if e.status in ('sales_paused','drawing','paused','finished','canceled','archived') then raise exception 'sales are not allowed for this event status'; end if;

  select * into s from public.event_settings where event_id=e.id;
  if reserve_only and not s.allow_reservations then raise exception 'reservations disabled'; end if;
  perform public._validate_buyer_fields(e.id,buyer_name,buyer_phone,buyer_email);
  perform public.expire_event_reservations(e.id);

  -- trava as cartelas para que duas operações simultâneas não consigam vender a mesma unidade.
  perform 1 from public.physical_cards
    where id=any(target_card_ids) and workspace_id=e.workspace_id and event_id=e.id
    order by id for update;

  select count(*) into card_count from public.physical_cards
    where id=any(target_card_ids) and workspace_id=e.workspace_id and event_id=e.id and status='available';
  if card_count<>cardinality(target_card_ids) then raise exception 'one or more cards are no longer available'; end if;

  effective_price := round(coalesce(unit_price,s.default_card_price)::numeric,2);
  if effective_price < 0 then raise exception 'invalid price'; end if;
  target_status := case when reserve_only then 'reserved'::public.sale_status else 'completed'::public.sale_status end;
  expires_at := case when reserve_only then now() + make_interval(mins=>greatest(1,s.reservation_minutes)) else null end;

  insert into public.sales(workspace_id,event_id,status,channel,seller_user_id,buyer_name,buyer_phone,buyer_email,buyer_notes,currency,total_amount,reservation_expires_at,completed_at)
    values(e.workspace_id,e.id,target_status,'organizer',auth.uid(),nullif(trim(buyer_name),''),nullif(trim(buyer_phone),''),nullif(trim(buyer_email),''),nullif(trim(buyer_notes),''),s.currency,effective_price*card_count,expires_at,case when reserve_only then null else now() end)
    returning id into sale_id;

  insert into public.sale_items(workspace_id,event_id,sale_id,physical_card_id,unit_price)
    select e.workspace_id,e.id,sale_id,id,effective_price from public.physical_cards where id=any(target_card_ids);

  if reserve_only then
    update public.physical_cards set status='reserved',current_sale_id=sale_id,reserved_at=now(),reserved_by_user_id=auth.uid(),reservation_expires_at=expires_at
      where id=any(target_card_ids);
  else
    update public.physical_cards set status='sold',current_sale_id=sale_id,sold_at=now(),sold_by_user_id=auth.uid(),reserved_at=null,reserved_by_user_id=null,reservation_expires_at=null
      where id=any(target_card_ids);
  end if;

  perform public.log_audit(e.workspace_id,case when reserve_only then 'sale.reserved' else 'sale.completed' end,'sale',sale_id::text,
    jsonb_build_object('event_id',e.id,'card_count',card_count,'total_amount',effective_price*card_count,'card_ids',target_card_ids));
  return sale_id;
end; $$;
revoke all on function public.create_card_sale(uuid,uuid[],text,text,text,text,numeric,boolean) from public;
grant execute on function public.create_card_sale(uuid,uuid[],text,text,text,text,numeric,boolean) to authenticated;

create or replace function public.complete_reserved_sale(target_sale_id uuid) returns void
language plpgsql security definer set search_path=public as $$
declare sa public.sales%rowtype; active_count integer;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into sa from public.sales where id=target_sale_id for update;
  if sa.id is null then raise exception 'sale not found'; end if;
  if not public.has_workspace_role(sa.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) then raise exception 'access denied'; end if;
  if sa.status<>'reserved' then raise exception 'sale is not reserved'; end if;
  if sa.reservation_expires_at is not null and sa.reservation_expires_at<=now() then
    perform public.expire_event_reservations(sa.event_id);
    raise exception 'reservation expired';
  end if;
  select count(*) into active_count from public.sale_items where sale_id=sa.id and status='active';
  if active_count=0 then raise exception 'sale has no active cards'; end if;
  if exists(select 1 from public.physical_cards where current_sale_id=sa.id and status<>'reserved') then raise exception 'reservation state conflict'; end if;
  update public.physical_cards set status='sold',sold_at=now(),sold_by_user_id=auth.uid(),reserved_at=null,reserved_by_user_id=null,reservation_expires_at=null where current_sale_id=sa.id and status='reserved';
  update public.sales set status='completed',completed_at=now(),reservation_expires_at=null,updated_at=now() where id=sa.id;
  perform public.log_audit(sa.workspace_id,'sale.completed','sale',sa.id::text,jsonb_build_object('event_id',sa.event_id,'from_reservation',true));
end; $$;
revoke all on function public.complete_reserved_sale(uuid) from public;
grant execute on function public.complete_reserved_sale(uuid) to authenticated;

create or replace function public.cancel_sale(target_sale_id uuid,reason text default null) returns void
language plpgsql security definer set search_path=public as $$
declare sa public.sales%rowtype; e public.events%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into sa from public.sales where id=target_sale_id for update;
  if sa.id is null then raise exception 'sale not found'; end if;
  if not public.has_workspace_role(sa.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) then raise exception 'access denied'; end if;
  if sa.status='canceled' then raise exception 'sale already canceled'; end if;
  select * into e from public.events where id=sa.event_id;
  if sa.status='completed' and e.status in ('drawing','paused','finished') then raise exception 'completed sales cannot be canceled after drawing starts'; end if;

  update public.sale_items set status='canceled',canceled_at=now() where sale_id=sa.id and status='active';
  update public.physical_cards set status='available',current_sale_id=null,sold_at=null,sold_by_user_id=null,reserved_at=null,reserved_by_user_id=null,reservation_expires_at=null
    where current_sale_id=sa.id and status in ('sold','reserved');
  update public.sales set status='canceled',canceled_at=now(),canceled_by=auth.uid(),cancel_reason=left(nullif(trim(reason),''),500),updated_at=now() where id=sa.id;
  perform public.log_audit(sa.workspace_id,'sale.canceled','sale',sa.id::text,jsonb_build_object('event_id',sa.event_id,'previous_status',sa.status,'reason',reason));
end; $$;
revoke all on function public.cancel_sale(uuid,text) from public;
grant execute on function public.cancel_sale(uuid,text) to authenticated;

create trigger sales_set_updated_at before update on public.sales for each row execute function public.set_updated_at();

-- Cartelas vendidas/reservadas só mudam por RPC. RLS existente de physical_cards continua somente leitura no cliente.
