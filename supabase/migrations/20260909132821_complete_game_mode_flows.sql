-- Integra vendedores, operadores e compradores aos modos especiais sem misturar dominios.
alter table public.raffle_tickets add column if not exists buyer_email text;
alter table public.raffle_tickets add column if not exists buyer_user_id uuid references auth.users(id) on delete set null;
alter table public.raffle_tickets add column if not exists sold_by uuid references auth.users(id) on delete set null;
create index if not exists raffle_tickets_buyer_user_idx on public.raffle_tickets(buyer_user_id,event_id);
create index if not exists raffle_tickets_buyer_email_idx on public.raffle_tickets(lower(trim(buyer_email)),event_id);

create table if not exists public.symbol_bingo_cards(
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
 event_id uuid not null references public.events(id) on delete cascade, sequence_number integer not null,
 code text not null, cells jsonb not null check(jsonb_typeof(cells)='array'),
 status text not null default 'available' check(status in ('available','reserved','sold')),
 buyer_name text, buyer_phone text, buyer_email text, buyer_user_id uuid references auth.users(id) on delete set null,
 sold_price numeric(12,2) check(sold_price>=0), sold_at timestamptz, sold_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(event_id,sequence_number), unique(event_id,code)
);
create index if not exists symbol_cards_event_status_idx on public.symbol_bingo_cards(event_id,status,sequence_number);
create index if not exists symbol_cards_buyer_user_idx on public.symbol_bingo_cards(buyer_user_id,event_id);
create index if not exists symbol_cards_buyer_email_idx on public.symbol_bingo_cards(lower(trim(buyer_email)),event_id);
alter table public.symbol_bingo_cards enable row level security;

-- Leitura estritamente vinculada ao papel ou à própria compra.
drop policy if exists raffle_tickets_read on public.raffle_tickets;
create policy raffle_tickets_read on public.raffle_tickets for select to authenticated using(
 public.has_workspace_role(workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[])
 or public.seller_has_event_access(event_id) or public.draw_operator_has_event_access(event_id)
 or (status='sold' and (buyer_user_id=auth.uid() or lower(trim(coalesce(buyer_email,'')))=lower(trim(coalesce(auth.jwt()->>'email','')))))
);
drop policy if exists symbol_bingo_cards_read on public.symbol_bingo_cards;
create policy symbol_bingo_cards_read on public.symbol_bingo_cards for select to authenticated using(
 public.has_workspace_role(workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[])
 or public.seller_has_event_access(event_id) or public.draw_operator_has_event_access(event_id)
 or (status='sold' and (buyer_user_id=auth.uid() or lower(trim(coalesce(buyer_email,'')))=lower(trim(coalesce(auth.jwt()->>'email','')))))
);
drop policy if exists symbol_bingo_configs_read on public.symbol_bingo_configs;
create policy symbol_bingo_configs_read on public.symbol_bingo_configs for select to authenticated using(
 public.has_workspace_role(workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[])
 or public.seller_has_event_access(event_id) or public.draw_operator_has_event_access(event_id)
 or exists(select 1 from public.symbol_bingo_cards c where c.event_id=symbol_bingo_configs.event_id and c.status='sold' and (c.buyer_user_id=auth.uid() or lower(trim(coalesce(c.buyer_email,'')))=lower(trim(coalesce(auth.jwt()->>'email','')))))
);
drop policy if exists symbol_bingo_items_read on public.symbol_bingo_items;
create policy symbol_bingo_items_read on public.symbol_bingo_items for select to authenticated using(
 public.has_workspace_role(workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[])
 or public.seller_has_event_access(event_id) or public.draw_operator_has_event_access(event_id)
 or exists(select 1 from public.symbol_bingo_cards c where c.event_id=symbol_bingo_items.event_id and c.status='sold' and (c.buyer_user_id=auth.uid() or lower(trim(coalesce(c.buyer_email,'')))=lower(trim(coalesce(auth.jwt()->>'email','')))))
);
grant select on public.symbol_bingo_cards to authenticated;
revoke insert,update,delete on public.raffle_tickets,public.symbol_bingo_cards from authenticated;

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
 if normalized_email<>'' then select id into resolved_user from auth.users where lower(email)=normalized_email and email_confirmed_at is not null limit 1; end if;
 update public.raffle_tickets set status=target_status,buyer_name=case when target_status='available' then null else nullif(trim(target_buyer_name),'') end,buyer_phone=case when target_status='available' then null else nullif(trim(target_buyer_phone),'') end,buyer_email=case when target_status='available' then null else nullif(normalized_email,'') end,buyer_user_id=case when target_status='available' then null else resolved_user end,sold_price=case when target_status='available' then null else coalesce(target_price,(select ticket_price from public.raffle_configs where event_id=e.id),0) end,sold_at=case when target_status='sold' then now() else null end,sold_by=case when target_status='sold' then auth.uid() else null end,updated_at=now() where id=t.id returning * into t;
 perform public.log_audit(e.workspace_id,'raffle.ticket_'||target_status,'raffle_ticket',t.id::text,jsonb_build_object('event_id',e.id,'number',t.number)); return t;
end $$;
revoke all on function public.sell_raffle_ticket(uuid,text,text,text,text,numeric) from public,anon; grant execute on function public.sell_raffle_ticket(uuid,text,text,text,text,numeric) to authenticated;

create or replace function public.generate_symbol_bingo_cards(target_event_id uuid,target_quantity integer)
returns integer language plpgsql security definer set search_path=public as $$
declare e public.events%rowtype; cfg public.symbol_bingo_configs%rowtype; next_seq integer; card_cells jsonb; n integer; needed integer; item_count integer;
begin
 select * into e from public.events where id=target_event_id for update; select * into cfg from public.symbol_bingo_configs where event_id=target_event_id;
 if e.id is null or e.game_mode<>'symbol_bingo' or not public.has_workspace_role(e.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) then raise exception 'access denied'; end if;
 if cfg.event_id is null or target_quantity not between 1 and 200 then raise exception 'invalid card generation'; end if;
 needed:=cfg.grid_size*cfg.grid_size-case when cfg.free_center then 1 else 0 end; select count(*) into item_count from public.symbol_bingo_items where event_id=e.id;
 if item_count<needed then raise exception 'not enough symbols'; end if; select coalesce(max(sequence_number),0) into next_seq from public.symbol_bingo_cards where event_id=e.id;
 for n in 1..target_quantity loop
  select jsonb_agg(id order by random()) into card_cells from (select id from public.symbol_bingo_items where event_id=e.id order by random() limit needed)s;
  insert into public.symbol_bingo_cards(workspace_id,event_id,sequence_number,code,cells) values(e.workspace_id,e.id,next_seq+n,'SIM-'||lpad((next_seq+n)::text,5,'0'),card_cells);
 end loop; return target_quantity;
end $$;
revoke all on function public.generate_symbol_bingo_cards(uuid,integer) from public,anon; grant execute on function public.generate_symbol_bingo_cards(uuid,integer) to authenticated;

create or replace function public.sell_symbol_bingo_card(target_card_id uuid,target_status text,target_buyer_name text default null,target_buyer_phone text default null,target_buyer_email text default null,target_price numeric default null)
returns public.symbol_bingo_cards language plpgsql security definer set search_path=public as $$
declare c public.symbol_bingo_cards%rowtype; e public.events%rowtype; resolved_user uuid; normalized_email text:=lower(trim(coalesce(target_buyer_email,'')));
begin
 select * into c from public.symbol_bingo_cards where id=target_card_id for update; select * into e from public.events where id=c.event_id;
 if c.id is null or e.game_mode<>'symbol_bingo' then raise exception 'symbol card not found'; end if;
 if not public.seller_has_event_access(e.id) and not public.has_workspace_role(e.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) then raise exception 'access denied'; end if;
 if target_status not in ('available','reserved','sold') then raise exception 'invalid card status'; end if;
 if target_status='sold' and trim(coalesce(target_buyer_name,''))='' then raise exception 'buyer name required'; end if;
 if normalized_email<>'' then select id into resolved_user from auth.users where lower(email)=normalized_email and email_confirmed_at is not null limit 1; end if;
 update public.symbol_bingo_cards set status=target_status,buyer_name=case when target_status='available' then null else nullif(trim(target_buyer_name),'') end,buyer_phone=case when target_status='available' then null else nullif(trim(target_buyer_phone),'') end,buyer_email=case when target_status='available' then null else nullif(normalized_email,'') end,buyer_user_id=case when target_status='available' then null else resolved_user end,sold_price=case when target_status='available' then null else coalesce(target_price,0) end,sold_at=case when target_status='sold' then now() else null end,sold_by=case when target_status='sold' then auth.uid() else null end,updated_at=now() where id=c.id returning * into c;
 perform public.log_audit(e.workspace_id,'symbol_bingo.card_'||target_status,'symbol_bingo_card',c.id::text,jsonb_build_object('event_id',e.id,'code',c.code)); return c;
end $$;
revoke all on function public.sell_symbol_bingo_card(uuid,text,text,text,text,numeric) from public,anon; grant execute on function public.sell_symbol_bingo_card(uuid,text,text,text,text,numeric) to authenticated;

create or replace function public.list_my_access_centers() returns jsonb language plpgsql stable security definer set search_path=public as $$
declare my_email text; email_confirmed timestamptz;
begin
 if auth.uid() is null then raise exception 'authentication required'; end if; select lower(email),email_confirmed_at into my_email,email_confirmed from auth.users where id=auth.uid();
 return jsonb_build_object('is_master',public.is_platform_owner(),
 'organizers',coalesce((select jsonb_agg(jsonb_build_object('workspace_id',w.id,'workspace_name',w.name,'role',wm.role::text) order by w.name) from public.workspace_members wm join public.workspaces w on w.id=wm.workspace_id where wm.user_id=auth.uid() and wm.status='active' and wm.role::text in ('organizer_owner','organizer_admin','event_manager') and w.is_active),'[]'::jsonb),
 'seller_events',coalesce((select jsonb_agg(jsonb_build_object('workspace_id',w.id,'workspace_name',w.name,'event_id',e.id,'event_name',e.name,'status',e.status,'starts_at',e.starts_at,'game_mode',e.game_mode) order by e.starts_at nulls last,e.name) from public.event_seller_assignments a join public.workspace_operational_memberships m on m.workspace_id=a.workspace_id and m.user_id=a.seller_user_id and m.role='seller' join public.events e on e.id=a.event_id join public.workspaces w on w.id=a.workspace_id where a.seller_user_id=auth.uid() and a.is_active and m.status='active' and w.is_active and public.workspace_license_active(w.id)),'[]'::jsonb),
 'operator_events',coalesce((select jsonb_agg(jsonb_build_object('workspace_id',w.id,'workspace_name',w.name,'event_id',e.id,'event_name',e.name,'status',e.status,'starts_at',e.starts_at,'game_mode',e.game_mode) order by e.starts_at nulls last,e.name) from public.event_draw_operator_assignments a join public.workspace_operational_memberships m on m.workspace_id=a.workspace_id and m.user_id=a.operator_user_id and m.role='draw_operator' join public.events e on e.id=a.event_id join public.workspaces w on w.id=a.workspace_id where a.operator_user_id=auth.uid() and a.is_active and m.status='active' and w.is_active and public.workspace_license_active(w.id)),'[]'::jsonb),
 'buyer_events',case when email_confirmed is null then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('event_id',q.event_id,'event_name',q.event_name,'status',q.status,'starts_at',q.starts_at,'organizer_name',q.organizer_name,'cards',q.qty,'game_mode',q.game_mode) order by q.starts_at nulls last) from (
  select e.id event_id,e.name event_name,e.status,e.starts_at,w.name organizer_name,e.game_mode,count(distinct si.physical_card_id)::int qty from public.sales s join public.sale_items si on si.sale_id=s.id and si.status='active' join public.physical_cards pc on pc.id=si.physical_card_id and pc.status='sold' join public.events e on e.id=s.event_id join public.workspaces w on w.id=s.workspace_id where s.status='completed' and lower(trim(coalesce(s.buyer_email,'')))=my_email group by e.id,w.name
  union all select e.id,e.name,e.status,e.starts_at,w.name,e.game_mode,count(*)::int from public.raffle_tickets t join public.events e on e.id=t.event_id join public.workspaces w on w.id=t.workspace_id where t.status='sold' and (t.buyer_user_id=auth.uid() or lower(trim(coalesce(t.buyer_email,'')))=my_email) group by e.id,w.name
  union all select e.id,e.name,e.status,e.starts_at,w.name,e.game_mode,count(*)::int from public.symbol_bingo_cards c join public.events e on e.id=c.event_id join public.workspaces w on w.id=c.workspace_id where c.status='sold' and (c.buyer_user_id=auth.uid() or lower(trim(coalesce(c.buyer_email,'')))=my_email) group by e.id,w.name
 )q),'[]'::jsonb) end);
end $$;
revoke all on function public.list_my_access_centers() from public,anon; grant execute on function public.list_my_access_centers() to authenticated;

create or replace function public.get_my_special_game_event(target_event_id uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare e public.events%rowtype; my_email text; confirmed timestamptz;
begin
 select lower(email),email_confirmed_at into my_email,confirmed from auth.users where id=auth.uid(); select * into e from public.events where id=target_event_id;
 if auth.uid() is null or confirmed is null or e.id is null or e.game_mode='number_bingo' then raise exception 'buyer access denied'; end if;
 if e.game_mode='raffle' and not exists(select 1 from public.raffle_tickets where event_id=e.id and status='sold' and (buyer_user_id=auth.uid() or lower(trim(coalesce(buyer_email,'')))=my_email)) then raise exception 'buyer access denied'; end if;
 if e.game_mode='symbol_bingo' and not exists(select 1 from public.symbol_bingo_cards where event_id=e.id and status='sold' and (buyer_user_id=auth.uid() or lower(trim(coalesce(buyer_email,'')))=my_email)) then raise exception 'buyer access denied'; end if;
 return jsonb_build_object('event',jsonb_build_object('id',e.id,'name',e.name,'status',e.status,'game_mode',e.game_mode),
 'config',case when e.game_mode='raffle' then (select to_jsonb(x) from public.raffle_configs x where x.event_id=e.id) else (select to_jsonb(x) from public.symbol_bingo_configs x where x.event_id=e.id) end,
 'purchases',case when e.game_mode='raffle' then coalesce((select jsonb_agg(jsonb_build_object('id',id,'number',number,'code',null,'cells','[]'::jsonb) order by number) from public.raffle_tickets where event_id=e.id and status='sold' and (buyer_user_id=auth.uid() or lower(trim(coalesce(buyer_email,'')))=my_email)),'[]'::jsonb) else coalesce((select jsonb_agg(jsonb_build_object('id',id,'number',null,'code',code,'cells',cells) order by sequence_number) from public.symbol_bingo_cards where event_id=e.id and status='sold' and (buyer_user_id=auth.uid() or lower(trim(coalesce(buyer_email,'')))=my_email)),'[]'::jsonb) end,
 'items',case when e.game_mode='symbol_bingo' then coalesce((select jsonb_agg(to_jsonb(i) order by i.position) from public.symbol_bingo_items i where i.event_id=e.id),'[]'::jsonb) else '[]'::jsonb end,
 'draws',case when e.game_mode='raffle' then coalesce((select jsonb_agg(jsonb_build_object('number',t.number,'draw_order',d.draw_order,'drawn_at',d.drawn_at) order by d.draw_order desc) from public.raffle_draws d join public.raffle_tickets t on t.id=d.ticket_id where d.event_id=e.id),'[]'::jsonb) else coalesce((select jsonb_agg(jsonb_build_object('item_id',d.item_id,'draw_order',d.draw_order,'drawn_at',d.drawn_at) order by d.draw_order desc) from public.symbol_bingo_draws d where d.event_id=e.id),'[]'::jsonb) end);
end $$;
revoke all on function public.get_my_special_game_event(uuid) from public,anon; grant execute on function public.get_my_special_game_event(uuid) to authenticated;
