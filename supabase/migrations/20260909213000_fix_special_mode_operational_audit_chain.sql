-- Mantem a auditoria dos modos especiais interna e limitada a um evento autorizado.
create or replace function public.log_special_game_audit(
  target_event_id uuid,target_action text,target_entity_type text,
  target_entity_id text default null,target_metadata jsonb default '{}'::jsonb
) returns bigint language plpgsql security definer set search_path=public as $$
declare e public.events%rowtype; new_id bigint;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into e from public.events where id=target_event_id;
  if e.id is null or e.game_mode not in ('raffle','symbol_bingo') then raise exception 'event not found'; end if;
  if not public.has_workspace_role(e.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[])
     and not public.seller_has_event_access(e.id)
     and not public.draw_operator_has_event_access(e.id)
  then raise exception 'access denied'; end if;
  insert into public.audit_logs(workspace_id,actor_user_id,action,entity_type,entity_id,metadata)
  values(e.workspace_id,auth.uid(),target_action,target_entity_type,target_entity_id,coalesce(target_metadata,'{}'::jsonb))
  returning id into new_id;
  return new_id;
end $$;
revoke all on function public.log_special_game_audit(uuid,text,text,text,jsonb) from public,anon,authenticated;

create or replace function public.sell_raffle_ticket(target_ticket_id uuid,target_status text,target_buyer_name text default null,target_buyer_phone text default null,target_buyer_email text default null,target_price numeric default null)
returns public.raffle_tickets language plpgsql security definer set search_path=public as $$
declare t public.raffle_tickets%rowtype; e public.events%rowtype; resolved_user uuid; normalized_email text:=lower(trim(coalesce(target_buyer_email,'')));
begin
 select * into t from public.raffle_tickets where id=target_ticket_id for update;
 select * into e from public.events where id=t.event_id;
 if t.id is null or e.game_mode<>'raffle' then raise exception 'raffle ticket not found'; end if;
 if not public.seller_has_event_access(e.id) and not public.has_workspace_role(e.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) then raise exception 'access denied'; end if;
 if target_status not in ('available','reserved','sold') then raise exception 'invalid ticket status'; end if;
 if target_status='sold' and trim(coalesce(target_buyer_name,''))='' then raise exception 'buyer name required'; end if;
 if normalized_email<>'' then select u.id into resolved_user from auth.users u where lower(u.email)=normalized_email and u.email_confirmed_at is not null limit 1; end if;
 update public.raffle_tickets set status=target_status,buyer_name=case when target_status='available' then null else nullif(trim(target_buyer_name),'') end,buyer_phone=case when target_status='available' then null else nullif(trim(target_buyer_phone),'') end,buyer_email=case when target_status='available' then null else nullif(normalized_email,'') end,buyer_user_id=case when target_status='available' then null else resolved_user end,sold_price=case when target_status='available' then null else coalesce(target_price,(select ticket_price from public.raffle_configs where event_id=e.id),0) end,sold_at=case when target_status='sold' then now() else null end,sold_by=case when target_status='sold' then auth.uid() else null end,updated_at=now() where id=t.id returning * into t;
 perform public.log_special_game_audit(e.id,'raffle.ticket_'||target_status,'raffle_ticket',t.id::text,jsonb_build_object('event_id',e.id,'number',t.number));
 return t;
end $$;
revoke all on function public.sell_raffle_ticket(uuid,text,text,text,text,numeric) from public,anon;
grant execute on function public.sell_raffle_ticket(uuid,text,text,text,text,numeric) to authenticated;

create or replace function public.sell_symbol_bingo_card(target_card_id uuid,target_status text,target_buyer_name text default null,target_buyer_phone text default null,target_buyer_email text default null,target_price numeric default null)
returns public.symbol_bingo_cards language plpgsql security definer set search_path=public as $$
declare c public.symbol_bingo_cards%rowtype; e public.events%rowtype; resolved_user uuid; normalized_email text:=lower(trim(coalesce(target_buyer_email,'')));
begin
 select * into c from public.symbol_bingo_cards where id=target_card_id for update;
 select * into e from public.events where id=c.event_id;
 if c.id is null or e.game_mode<>'symbol_bingo' then raise exception 'symbol card not found'; end if;
 if not public.seller_has_event_access(e.id) and not public.has_workspace_role(e.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) then raise exception 'access denied'; end if;
 if target_status not in ('available','reserved','sold') then raise exception 'invalid card status'; end if;
 if target_status='sold' and trim(coalesce(target_buyer_name,''))='' then raise exception 'buyer name required'; end if;
 if normalized_email<>'' then select u.id into resolved_user from auth.users u where lower(u.email)=normalized_email and u.email_confirmed_at is not null limit 1; end if;
 update public.symbol_bingo_cards set status=target_status,buyer_name=case when target_status='available' then null else nullif(trim(target_buyer_name),'') end,buyer_phone=case when target_status='available' then null else nullif(trim(target_buyer_phone),'') end,buyer_email=case when target_status='available' then null else nullif(normalized_email,'') end,buyer_user_id=case when target_status='available' then null else resolved_user end,sold_price=case when target_status='available' then null else coalesce(target_price,0) end,sold_at=case when target_status='sold' then now() else null end,sold_by=case when target_status='sold' then auth.uid() else null end,updated_at=now() where id=c.id returning * into c;
 perform public.log_special_game_audit(e.id,'symbol_bingo.card_'||target_status,'symbol_bingo_card',c.id::text,jsonb_build_object('event_id',e.id,'code',c.code));
 return c;
end $$;
revoke all on function public.sell_symbol_bingo_card(uuid,text,text,text,text,numeric) from public,anon;
grant execute on function public.sell_symbol_bingo_card(uuid,text,text,text,text,numeric) to authenticated;

create or replace function public.draw_raffle_winner(target_event_id uuid) returns public.raffle_tickets
language plpgsql security definer set search_path=public as $$
declare e public.events%rowtype; winner public.raffle_tickets%rowtype; next_order integer;
begin
 select * into e from public.events where id=target_event_id for update;
 if e.id is null or e.game_mode<>'raffle' then raise exception 'raffle event not found'; end if;
 if not public.has_workspace_role(e.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) and not public.draw_operator_has_event_access(e.id) then raise exception 'access denied'; end if;
 select t.* into winner from public.raffle_tickets t where t.event_id=e.id and t.status='sold' and not exists(select 1 from public.raffle_draws d where d.ticket_id=t.id) order by random() limit 1 for update;
 if winner.id is null then raise exception 'no eligible sold tickets'; end if;
 select coalesce(max(draw_order),0)+1 into next_order from public.raffle_draws where event_id=e.id;
 insert into public.raffle_draws(workspace_id,event_id,ticket_id,draw_order,drawn_by) values(e.workspace_id,e.id,winner.id,next_order,auth.uid());
 perform public.log_special_game_audit(e.id,'raffle.winner_drawn','raffle_ticket',winner.id::text,jsonb_build_object('event_id',e.id,'number',winner.number,'draw_order',next_order));
 return winner;
end $$;
revoke all on function public.draw_raffle_winner(uuid) from public,anon;
grant execute on function public.draw_raffle_winner(uuid) to authenticated;

create or replace function public.draw_next_symbol(target_event_id uuid) returns public.symbol_bingo_items
language plpgsql security definer set search_path=public as $$
declare e public.events%rowtype; chosen public.symbol_bingo_items%rowtype; next_order integer;
begin
 select * into e from public.events where id=target_event_id for update;
 if e.id is null or e.game_mode<>'symbol_bingo' then raise exception 'symbol bingo event not found'; end if;
 if not public.has_workspace_role(e.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) and not public.draw_operator_has_event_access(e.id) then raise exception 'access denied'; end if;
 select i.* into chosen from public.symbol_bingo_items i where i.event_id=e.id and not exists(select 1 from public.symbol_bingo_draws d where d.item_id=i.id) order by random() limit 1 for update;
 if chosen.id is null then raise exception 'no symbols remaining'; end if;
 select coalesce(max(draw_order),0)+1 into next_order from public.symbol_bingo_draws where event_id=e.id;
 insert into public.symbol_bingo_draws(workspace_id,event_id,item_id,draw_order,drawn_by) values(e.workspace_id,e.id,chosen.id,next_order,auth.uid());
 perform public.log_special_game_audit(e.id,'symbol_bingo.item_drawn','symbol_bingo_item',chosen.id::text,jsonb_build_object('event_id',e.id,'label',chosen.label,'draw_order',next_order));
 return chosen;
end $$;
revoke all on function public.draw_next_symbol(uuid) from public,anon;
grant execute on function public.draw_next_symbol(uuid) to authenticated;

-- Cartelas persistem IDs dos simbolos em JSON; trocar o tema depois as deixaria orfas.
create or replace function public.configure_symbol_bingo(target_event_id uuid,target_theme_name text,target_grid_size integer,target_animation_seconds integer,target_free_center boolean,target_items jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare e public.events%rowtype; item jsonb; labels text[]:=array[]::text[]; pos integer:=0;
begin
 select * into e from public.events where id=target_event_id for update;
 if e.id is null or e.game_mode<>'symbol_bingo' or not public.has_workspace_role(e.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) then raise exception 'access denied'; end if;
 if target_grid_size not between 3 and 5 or target_animation_seconds not between 3 and 60 or jsonb_array_length(target_items)<target_grid_size*target_grid_size then raise exception 'invalid symbol bingo settings'; end if;
 if exists(select 1 from public.symbol_bingo_draws where event_id=e.id) then raise exception 'cannot change symbols after drawing starts'; end if;
 if exists(select 1 from public.symbol_bingo_cards where event_id=e.id) then raise exception 'cannot change symbols after cards are generated'; end if;
 insert into public.symbol_bingo_configs(event_id,workspace_id,theme_name,grid_size,animation_seconds,free_center) values(e.id,e.workspace_id,left(trim(target_theme_name),80),target_grid_size,target_animation_seconds,target_free_center)
 on conflict(event_id) do update set theme_name=excluded.theme_name,grid_size=excluded.grid_size,animation_seconds=excluded.animation_seconds,free_center=excluded.free_center,updated_at=now();
 delete from public.symbol_bingo_items where event_id=e.id;
 for item in select value from jsonb_array_elements(target_items) loop
  pos:=pos+1;
  if trim(item->>'label')=any(labels) then raise exception 'duplicate symbol label'; end if;
  labels:=array_append(labels,trim(item->>'label'));
  insert into public.symbol_bingo_items(workspace_id,event_id,position,label,symbol,riddle) values(e.workspace_id,e.id,pos,left(trim(item->>'label'),80),left(trim(item->>'symbol'),16),left(trim(item->>'riddle'),300));
 end loop;
end $$;
revoke all on function public.configure_symbol_bingo(uuid,text,integer,integer,boolean,jsonb) from public,anon;
grant execute on function public.configure_symbol_bingo(uuid,text,integer,integer,boolean,jsonb) to authenticated;
