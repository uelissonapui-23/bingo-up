-- A raffle draw belongs to a named prize. This keeps every result auditable
-- and prevents the generic bingo draw flow from being reused for raffles.
create table if not exists public.raffle_prizes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  position integer not null check (position between 1 and 100),
  name text not null check (char_length(trim(name)) between 1 and 160),
  description text,
  delivered_at timestamptz,
  delivered_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id, position)
);

alter table public.raffle_draws add column if not exists prize_id uuid references public.raffle_prizes(id) on delete restrict;
create unique index if not exists raffle_draws_prize_unique on public.raffle_draws(prize_id) where prize_id is not null;
create index if not exists raffle_prizes_event_position_idx on public.raffle_prizes(event_id, position);
alter table public.raffle_prizes enable row level security;

drop policy if exists raffle_prizes_read on public.raffle_prizes;
create policy raffle_prizes_read on public.raffle_prizes for select to authenticated using (
  public.has_workspace_role(workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[])
  or public.draw_operator_has_event_access(event_id) or public.seller_has_event_access(event_id)
);
revoke all on public.raffle_prizes from anon;
grant select on public.raffle_prizes to authenticated;

-- Preserve old raffle results by creating one historical prize for each draw.
insert into public.raffle_prizes(workspace_id,event_id,position,name,description,created_at)
select d.workspace_id,d.event_id,d.draw_order,
       coalesce(nullif(trim(c.prize_description),''),'Prêmio '||d.draw_order),
       'Resultado anterior à gestão individual de prêmios',d.drawn_at
from public.raffle_draws d
left join public.raffle_configs c on c.event_id=d.event_id
where d.prize_id is null
on conflict(event_id,position) do nothing;

update public.raffle_draws d set prize_id=p.id
from public.raffle_prizes p
where d.prize_id is null and p.event_id=d.event_id and p.position=d.draw_order;

create or replace function public.configure_raffle_prizes(target_event_id uuid,target_prizes jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare e public.events%rowtype; item jsonb; pos integer:=0; prize_name text;
begin
  select * into e from public.events where id=target_event_id for update;
  if e.id is null or e.game_mode<>'raffle' or not public.has_workspace_role(e.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) then raise exception 'access denied'; end if;
  if jsonb_typeof(target_prizes)<>'array' or jsonb_array_length(target_prizes) not between 1 and 100 then raise exception 'invalid raffle prizes'; end if;
  if exists(select 1 from public.raffle_draws where event_id=e.id) then raise exception 'cannot change prizes after drawing starts'; end if;
  delete from public.raffle_prizes where event_id=e.id;
  for item in select value from jsonb_array_elements(target_prizes) loop
    pos:=pos+1; prize_name:=trim(coalesce(item->>'name',''));
    if char_length(prize_name) not between 1 and 160 then raise exception 'invalid prize name'; end if;
    insert into public.raffle_prizes(workspace_id,event_id,position,name,description)
    values(e.workspace_id,e.id,pos,prize_name,nullif(left(trim(coalesce(item->>'description','')),500),''));
  end loop;
  update public.raffle_configs set prize_description=(select string_agg(name,'; ' order by position) from public.raffle_prizes where event_id=e.id),updated_at=now() where event_id=e.id;
  perform public.log_special_game_audit(e.id,'raffle.prizes_configured','event',e.id::text,jsonb_build_object('count',pos));
end $$;
revoke all on function public.configure_raffle_prizes(uuid,jsonb) from public,anon;
grant execute on function public.configure_raffle_prizes(uuid,jsonb) to authenticated;

create or replace function public.draw_raffle_prize(target_event_id uuid,target_prize_id uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare e public.events%rowtype; p public.raffle_prizes%rowtype; winner public.raffle_tickets%rowtype; next_order integer; new_draw public.raffle_draws%rowtype;
begin
  select * into e from public.events where id=target_event_id for update;
  if e.id is null or e.game_mode<>'raffle' then raise exception 'raffle event not found'; end if;
  if not public.has_workspace_role(e.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) and not public.draw_operator_has_event_access(e.id) then raise exception 'access denied'; end if;
  select * into p from public.raffle_prizes where id=target_prize_id and event_id=e.id for update;
  if p.id is null then raise exception 'raffle prize not found'; end if;
  if exists(select 1 from public.raffle_draws where prize_id=p.id) then raise exception 'prize already drawn'; end if;
  select t.* into winner from public.raffle_tickets t where t.event_id=e.id and t.status='sold'
    and not exists(select 1 from public.raffle_draws d where d.ticket_id=t.id)
    order by random() limit 1 for update;
  if winner.id is null then raise exception 'no eligible sold tickets'; end if;
  select coalesce(max(draw_order),0)+1 into next_order from public.raffle_draws where event_id=e.id;
  insert into public.raffle_draws(workspace_id,event_id,ticket_id,prize_id,draw_order,drawn_by)
  values(e.workspace_id,e.id,winner.id,p.id,next_order,auth.uid()) returning * into new_draw;
  perform public.log_special_game_audit(e.id,'raffle.prize_drawn','raffle_prize',p.id::text,jsonb_build_object('number',winner.number,'ticket_id',winner.id,'draw_order',next_order));
  return jsonb_build_object('id',new_draw.id,'draw_order',next_order,'drawn_at',new_draw.drawn_at,'prize',to_jsonb(p),'ticket',to_jsonb(winner));
end $$;
revoke all on function public.draw_raffle_prize(uuid,uuid) from public,anon;
grant execute on function public.draw_raffle_prize(uuid,uuid) to authenticated;

create or replace function public.set_raffle_prize_delivered(target_prize_id uuid,target_delivered boolean) returns void
language plpgsql security definer set search_path=public as $$
declare p public.raffle_prizes%rowtype;
begin
  select * into p from public.raffle_prizes where id=target_prize_id for update;
  if p.id is null or not public.has_workspace_role(p.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) then raise exception 'access denied'; end if;
  if not exists(select 1 from public.raffle_draws where prize_id=p.id) then raise exception 'prize has no winner'; end if;
  update public.raffle_prizes set delivered_at=case when target_delivered then now() else null end,delivered_by=case when target_delivered then auth.uid() else null end,updated_at=now() where id=p.id;
  perform public.log_special_game_audit(p.event_id,'raffle.prize_delivery_changed','raffle_prize',p.id::text,jsonb_build_object('delivered',target_delivered));
end $$;
revoke all on function public.set_raffle_prize_delivered(uuid,boolean) from public,anon;
grant execute on function public.set_raffle_prize_delivered(uuid,boolean) to authenticated;

create or replace function public.get_special_game_default_price(target_event_id uuid) returns numeric
language plpgsql security definer stable set search_path=public as $$
declare e public.events%rowtype; result numeric;
begin
  select * into e from public.events where id=target_event_id;
  if e.id is null or e.game_mode='number_bingo' then raise exception 'special event not found'; end if;
  if not public.has_workspace_role(e.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[])
     and not public.seller_has_event_access(e.id) and not public.draw_operator_has_event_access(e.id) then raise exception 'access denied'; end if;
  if e.game_mode='raffle' then select ticket_price into result from public.raffle_configs where event_id=e.id; end if;
  if result is null then select default_card_price into result from public.event_settings where event_id=e.id; end if;
  return coalesce(result,0);
end $$;
revoke all on function public.get_special_game_default_price(uuid) from public,anon;
grant execute on function public.get_special_game_default_price(uuid) to authenticated;

-- Seller/operator reads only through the same event assignment boundary.
drop policy if exists raffle_draws_read on public.raffle_draws;
create policy raffle_draws_read on public.raffle_draws for select to authenticated using (
 public.has_workspace_role(workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[])
 or public.draw_operator_has_event_access(event_id) or public.seller_has_event_access(event_id)
);

create or replace function public.get_my_special_game_event(target_event_id uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare e public.events%rowtype; my_email text; confirmed timestamptz;
begin
 select lower(email),email_confirmed_at into my_email,confirmed from auth.users where id=auth.uid(); select * into e from public.events where id=target_event_id;
 if auth.uid() is null or confirmed is null or e.id is null or e.game_mode='number_bingo' then raise exception 'buyer access denied'; end if;
 if e.game_mode='raffle' and not exists(select 1 from public.raffle_tickets where event_id=e.id and status='sold' and (buyer_user_id=auth.uid() or lower(trim(coalesce(buyer_email,'')))=my_email)) then raise exception 'buyer access denied'; end if;
 if e.game_mode='symbol_bingo' and not exists(select 1 from public.symbol_bingo_cards where event_id=e.id and status='sold' and (buyer_user_id=auth.uid() or lower(trim(coalesce(buyer_email,'')))=my_email)) then raise exception 'buyer access denied'; end if;
 return jsonb_build_object('event',jsonb_build_object('id',e.id,'name',e.name,'status',e.status,'game_mode',e.game_mode),'config',case when e.game_mode='raffle' then (select to_jsonb(x) from public.raffle_configs x where x.event_id=e.id) else (select to_jsonb(x) from public.symbol_bingo_configs x where x.event_id=e.id) end,'purchases',case when e.game_mode='raffle' then coalesce((select jsonb_agg(jsonb_build_object('id',id,'number',number,'code',null,'cells','[]'::jsonb) order by number) from public.raffle_tickets where event_id=e.id and status='sold' and (buyer_user_id=auth.uid() or lower(trim(coalesce(buyer_email,'')))=my_email)),'[]'::jsonb) else coalesce((select jsonb_agg(jsonb_build_object('id',id,'number',null,'code',code,'cells',cells) order by sequence_number) from public.symbol_bingo_cards where event_id=e.id and status='sold' and (buyer_user_id=auth.uid() or lower(trim(coalesce(buyer_email,'')))=my_email)),'[]'::jsonb) end,'items',case when e.game_mode='symbol_bingo' then coalesce((select jsonb_agg(to_jsonb(i) order by i.position) from public.symbol_bingo_items i where i.event_id=e.id),'[]'::jsonb) else '[]'::jsonb end,'draws',case when e.game_mode='raffle' then coalesce((select jsonb_agg(jsonb_build_object('number',t.number,'prize_name',p.name,'prize_description',p.description,'draw_order',d.draw_order,'drawn_at',d.drawn_at) order by d.draw_order desc) from public.raffle_draws d join public.raffle_tickets t on t.id=d.ticket_id left join public.raffle_prizes p on p.id=d.prize_id where d.event_id=e.id),'[]'::jsonb) else coalesce((select jsonb_agg(jsonb_build_object('item_id',d.item_id,'draw_order',d.draw_order,'drawn_at',d.drawn_at) order by d.draw_order desc) from public.symbol_bingo_draws d where d.event_id=e.id),'[]'::jsonb) end);
end $$;
revoke all on function public.get_my_special_game_event(uuid) from public,anon;
grant execute on function public.get_my_special_game_event(uuid) to authenticated;
