-- Modos adicionais sem alterar o funcionamento do bingo numerico existente.
alter table public.events add column if not exists game_mode text not null default 'number_bingo';
alter table public.events drop constraint if exists events_game_mode_check;
alter table public.events add constraint events_game_mode_check check (game_mode in ('number_bingo','raffle','symbol_bingo'));

create table if not exists public.raffle_configs (
  event_id uuid primary key references public.events(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  total_numbers integer not null check(total_numbers between 2 and 10000),
  ticket_price numeric(12,2) not null default 0 check(ticket_price>=0),
  animation_seconds integer not null default 8 check(animation_seconds between 3 and 60),
  prize_description text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.raffle_tickets (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade, number integer not null check(number>0),
  status text not null default 'available' check(status in ('available','reserved','sold')),
  buyer_name text, buyer_phone text, sold_price numeric(12,2) check(sold_price>=0),
  sold_at timestamptz, updated_at timestamptz not null default now(), unique(event_id,number)
);
create table if not exists public.raffle_draws (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  ticket_id uuid not null references public.raffle_tickets(id) on delete restrict,
  draw_order integer not null, drawn_by uuid not null references auth.users(id), drawn_at timestamptz not null default now(),
  unique(event_id,ticket_id), unique(event_id,draw_order)
);
create index if not exists raffle_tickets_event_status_idx on public.raffle_tickets(event_id,status,number);
create index if not exists raffle_draws_event_order_idx on public.raffle_draws(event_id,draw_order desc);

create table if not exists public.symbol_bingo_configs (
  event_id uuid primary key references public.events(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  theme_name text not null, grid_size integer not null default 4 check(grid_size between 3 and 5),
  animation_seconds integer not null default 8 check(animation_seconds between 3 and 60),
  free_center boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.symbol_bingo_items (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade, position integer not null check(position>0),
  label text not null check(char_length(trim(label)) between 1 and 80), symbol text not null check(char_length(trim(symbol)) between 1 and 16),
  riddle text not null check(char_length(trim(riddle)) between 3 and 300),
  created_at timestamptz not null default now(), unique(event_id,position), unique(event_id,label)
);
create table if not exists public.symbol_bingo_draws (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  item_id uuid not null references public.symbol_bingo_items(id) on delete restrict,
  draw_order integer not null, drawn_by uuid not null references auth.users(id), drawn_at timestamptz not null default now(),
  unique(event_id,item_id), unique(event_id,draw_order)
);
create index if not exists symbol_items_event_position_idx on public.symbol_bingo_items(event_id,position);
create index if not exists symbol_draws_event_order_idx on public.symbol_bingo_draws(event_id,draw_order desc);

alter table public.raffle_configs enable row level security; alter table public.raffle_tickets enable row level security;
alter table public.raffle_draws enable row level security; alter table public.symbol_bingo_configs enable row level security;
alter table public.symbol_bingo_items enable row level security; alter table public.symbol_bingo_draws enable row level security;

do $$ declare t text; begin foreach t in array array['raffle_configs','raffle_tickets','raffle_draws','symbol_bingo_configs','symbol_bingo_items','symbol_bingo_draws'] loop
  execute format('drop policy if exists %I on public.%I',t||'_read',t);
  execute format('create policy %I on public.%I for select to authenticated using (public.has_workspace_role(workspace_id,array[''organizer_owner'',''organizer_admin'',''event_manager'']::public.workspace_role[]) or public.draw_operator_has_event_access(event_id))',t||'_read',t);
  if t not in ('raffle_draws','symbol_bingo_draws') then
    execute format('create policy %I on public.%I for insert to authenticated with check (public.has_workspace_role(workspace_id,array[''organizer_owner'',''organizer_admin'',''event_manager'']::public.workspace_role[]))',t||'_insert',t);
    execute format('create policy %I on public.%I for update to authenticated using (public.has_workspace_role(workspace_id,array[''organizer_owner'',''organizer_admin'',''event_manager'']::public.workspace_role[])) with check (public.has_workspace_role(workspace_id,array[''organizer_owner'',''organizer_admin'',''event_manager'']::public.workspace_role[]))',t||'_update',t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.has_workspace_role(workspace_id,array[''organizer_owner'',''organizer_admin'',''event_manager'']::public.workspace_role[]))',t||'_delete',t);
    execute format('grant select,insert,update,delete on public.%I to authenticated',t);
  else
    execute format('revoke insert,update,delete on public.%I from authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
  end if;
end loop; end $$;

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
 perform public.log_audit(e.workspace_id,'raffle.winner_drawn','raffle_ticket',winner.id::text,jsonb_build_object('event_id',e.id,'number',winner.number,'draw_order',next_order));
 return winner;
end $$;
revoke all on function public.draw_raffle_winner(uuid) from public,anon; grant execute on function public.draw_raffle_winner(uuid) to authenticated;

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
 perform public.log_audit(e.workspace_id,'symbol_bingo.item_drawn','symbol_bingo_item',chosen.id::text,jsonb_build_object('event_id',e.id,'label',chosen.label,'draw_order',next_order));
 return chosen;
end $$;
revoke all on function public.draw_next_symbol(uuid) from public,anon; grant execute on function public.draw_next_symbol(uuid) to authenticated;

create or replace function public.configure_raffle(target_event_id uuid,target_total_numbers integer,target_ticket_price numeric,target_animation_seconds integer,target_prize text default null) returns void
language plpgsql security definer set search_path=public as $$ declare e public.events%rowtype; begin
 select * into e from public.events where id=target_event_id for update;
 if e.id is null or e.game_mode<>'raffle' or not public.has_workspace_role(e.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) then raise exception 'access denied'; end if;
 if target_total_numbers not between 2 and 10000 or target_ticket_price<0 or target_animation_seconds not between 3 and 60 then raise exception 'invalid raffle settings'; end if;
 if exists(select 1 from public.raffle_tickets where event_id=e.id and number>target_total_numbers and status<>'available') then raise exception 'cannot reduce below a reserved or sold number'; end if;
 insert into public.raffle_configs(event_id,workspace_id,total_numbers,ticket_price,animation_seconds,prize_description) values(e.id,e.workspace_id,target_total_numbers,target_ticket_price,target_animation_seconds,nullif(trim(target_prize),''))
 on conflict(event_id) do update set total_numbers=excluded.total_numbers,ticket_price=excluded.ticket_price,animation_seconds=excluded.animation_seconds,prize_description=excluded.prize_description,updated_at=now();
 delete from public.raffle_tickets where event_id=e.id and number>target_total_numbers and status='available';
 insert into public.raffle_tickets(workspace_id,event_id,number) select e.workspace_id,e.id,n from generate_series(1,target_total_numbers)n on conflict(event_id,number) do nothing;
end $$;
revoke all on function public.configure_raffle(uuid,integer,numeric,integer,text) from public,anon; grant execute on function public.configure_raffle(uuid,integer,numeric,integer,text) to authenticated;

create or replace function public.configure_symbol_bingo(target_event_id uuid,target_theme_name text,target_grid_size integer,target_animation_seconds integer,target_free_center boolean,target_items jsonb) returns void
language plpgsql security definer set search_path=public as $$ declare e public.events%rowtype; item jsonb; labels text[]:=array[]::text[]; pos integer:=0; begin
 select * into e from public.events where id=target_event_id for update;
 if e.id is null or e.game_mode<>'symbol_bingo' or not public.has_workspace_role(e.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) then raise exception 'access denied'; end if;
 if target_grid_size not between 3 and 5 or target_animation_seconds not between 3 and 60 or jsonb_array_length(target_items)<target_grid_size*target_grid_size then raise exception 'invalid symbol bingo settings'; end if;
 if exists(select 1 from public.symbol_bingo_draws where event_id=e.id) then raise exception 'cannot change symbols after drawing starts'; end if;
 insert into public.symbol_bingo_configs(event_id,workspace_id,theme_name,grid_size,animation_seconds,free_center) values(e.id,e.workspace_id,left(trim(target_theme_name),80),target_grid_size,target_animation_seconds,target_free_center)
 on conflict(event_id) do update set theme_name=excluded.theme_name,grid_size=excluded.grid_size,animation_seconds=excluded.animation_seconds,free_center=excluded.free_center,updated_at=now();
 delete from public.symbol_bingo_items where event_id=e.id;
 for item in select value from jsonb_array_elements(target_items) loop pos:=pos+1; if trim(item->>'label')=any(labels) then raise exception 'duplicate symbol label'; end if; labels:=array_append(labels,trim(item->>'label'));
   insert into public.symbol_bingo_items(workspace_id,event_id,position,label,symbol,riddle) values(e.workspace_id,e.id,pos,left(trim(item->>'label'),80),left(trim(item->>'symbol'),16),left(trim(item->>'riddle'),300));
 end loop;
end $$;
revoke all on function public.configure_symbol_bingo(uuid,text,integer,integer,boolean,jsonb) from public,anon; grant execute on function public.configure_symbol_bingo(uuid,text,integer,integer,boolean,jsonb) to authenticated;
