-- Fase 7: motor de sorteio manual, recuperação de sessão e snapshot dos jogos participantes.
-- As estruturas já ficam prontas para acompanhamento automático, premiação e painel público nas próximas fases.

create type public.draw_session_status as enum ('active','paused','finished','canceled');
create type public.draw_number_status as enum ('called','voided');

create table public.draw_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  rule_set_id uuid not null references public.bingo_rule_sets(id) on delete restrict,
  session_number integer not null check (session_number >= 1),
  name text not null,
  status public.draw_session_status not null default 'active',
  total_balls integer not null check (total_balls between 1 and 1000),
  win_pattern_code text not null,
  win_pattern_snapshot jsonb not null check (jsonb_typeof(win_pattern_snapshot)='object'),
  rule_snapshot jsonb not null check (jsonb_typeof(rule_snapshot)='object'),
  participant_cards integer not null default 0 check (participant_cards >= 0),
  participant_games integer not null default 0 check (participant_games >= 0),
  called_count integer not null default 0 check (called_count >= 0),
  last_called_number integer,
  public_token uuid not null default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  started_at timestamptz not null default now(),
  paused_at timestamptz,
  finished_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id, session_number),
  unique(public_token),
  check (last_called_number is null or (last_called_number between 1 and total_balls)),
  check (called_count <= total_balls)
);

create unique index draw_sessions_one_open_per_event_idx on public.draw_sessions(event_id) where status in ('active','paused');
create index draw_sessions_event_history_idx on public.draw_sessions(workspace_id,event_id,session_number desc);
create index draw_sessions_public_token_idx on public.draw_sessions(public_token);

create table public.draw_session_games (
  session_id uuid not null references public.draw_sessions(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  physical_card_id uuid not null references public.physical_cards(id) on delete restrict,
  card_game_id uuid not null references public.card_games(id) on delete restrict,
  game_definition_id uuid not null references public.game_definitions(id) on delete restrict,
  position smallint not null check (position between 1 and 6),
  created_at timestamptz not null default now(),
  primary key(session_id, card_game_id)
);

create index draw_session_games_session_idx on public.draw_session_games(session_id,physical_card_id,position);
create index draw_session_games_definition_idx on public.draw_session_games(session_id,game_definition_id);

create table public.draw_numbers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  session_id uuid not null references public.draw_sessions(id) on delete cascade,
  number integer not null check (number between 1 and 1000),
  sequence_number integer not null check (sequence_number >= 1),
  status public.draw_number_status not null default 'called',
  called_by uuid references auth.users(id) on delete set null default auth.uid(),
  called_at timestamptz not null default now(),
  voided_by uuid references auth.users(id) on delete set null,
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz not null default now(),
  unique(session_id, sequence_number)
);

create unique index draw_numbers_active_number_idx on public.draw_numbers(session_id,number) where status='called';
create index draw_numbers_session_sequence_idx on public.draw_numbers(session_id,sequence_number desc);
create index draw_numbers_event_idx on public.draw_numbers(workspace_id,event_id,called_at desc);

alter table public.draw_sessions enable row level security;
alter table public.draw_session_games enable row level security;
alter table public.draw_numbers enable row level security;

create policy draw_sessions_member_select on public.draw_sessions for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy draw_session_games_member_select on public.draw_session_games for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy draw_numbers_member_select on public.draw_numbers for select to authenticated
  using (public.is_workspace_member(workspace_id));

-- Toda escrita crítica passa por RPC para preservar estado, auditoria e concorrência.

create or replace function public.create_draw_session(
  target_event_id uuid,
  target_rule_set_id uuid default null,
  target_win_pattern_code text default null,
  target_name text default null
) returns uuid
language plpgsql security definer set search_path=public as $$
declare
  e public.events%rowtype;
  r public.bingo_rule_sets%rowtype;
  new_id uuid;
  next_session integer;
  pattern jsonb;
  card_count integer;
  game_count integer;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into e from public.events where id=target_event_id for update;
  if e.id is null then raise exception 'event not found'; end if;
  if not public.has_workspace_role(e.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) then raise exception 'access denied'; end if;
  if e.status in ('drawing','paused','finished','canceled','archived') then raise exception 'event status does not allow a new draw'; end if;
  if exists(select 1 from public.draw_sessions where event_id=e.id and status in ('active','paused')) then raise exception 'event already has an open draw session'; end if;

  perform public.expire_event_reservations(e.id);

  if target_rule_set_id is null then
    select * into r from public.bingo_rule_sets where event_id=e.id and is_default=true and is_active=true order by created_at limit 1;
  else
    select * into r from public.bingo_rule_sets where id=target_rule_set_id and event_id=e.id and is_active=true;
  end if;
  if r.id is null then raise exception 'active rule set not found'; end if;

  if target_win_pattern_code is null then
    pattern := r.win_patterns->0;
  else
    select p.value into pattern from jsonb_array_elements(r.win_patterns) as p(value) where p.value->>'code'=target_win_pattern_code limit 1;
  end if;
  if pattern is null then raise exception 'win pattern not found'; end if;

  select coalesce(max(session_number),0)+1 into next_session from public.draw_sessions where event_id=e.id;
  select count(*) into card_count from public.physical_cards where event_id=e.id and status='sold';
  select count(*) into game_count
    from public.card_games cg join public.physical_cards pc on pc.id=cg.physical_card_id
    where pc.event_id=e.id and pc.status='sold';
  if game_count=0 then raise exception 'at least one sold card is required to start the draw'; end if;

  insert into public.draw_sessions(
    workspace_id,event_id,rule_set_id,session_number,name,status,total_balls,
    win_pattern_code,win_pattern_snapshot,rule_snapshot,participant_cards,participant_games
  ) values (
    e.workspace_id,e.id,r.id,next_session,
    coalesce(nullif(trim(target_name),''),'Rodada '||next_session::text),'active',r.total_balls,
    pattern->>'code',pattern,
    jsonb_build_object(
      'name',r.name,'code',r.code,'total_balls',r.total_balls,'grid_rows',r.grid_rows,'grid_columns',r.grid_columns,
      'numbers_per_game',r.numbers_per_game,'free_center',r.free_center,'distribution_mode',r.distribution_mode,
      'column_definitions',r.column_definitions,'win_patterns',r.win_patterns
    ),card_count,game_count
  ) returning id into new_id;

  insert into public.draw_session_games(session_id,workspace_id,event_id,physical_card_id,card_game_id,game_definition_id,position)
    select new_id,e.workspace_id,e.id,pc.id,cg.id,cg.game_definition_id,cg.position
    from public.physical_cards pc join public.card_games cg on cg.physical_card_id=pc.id
    where pc.event_id=e.id and pc.status='sold';

  update public.events set status='drawing',updated_at=now() where id=e.id;
  perform public.log_audit(e.workspace_id,'draw.started','draw_session',new_id::text,
    jsonb_build_object('event_id',e.id,'session_number',next_session,'participant_cards',card_count,'participant_games',game_count,'win_pattern',pattern->>'code'));
  return new_id;
end; $$;
revoke all on function public.create_draw_session(uuid,uuid,text,text) from public;
grant execute on function public.create_draw_session(uuid,uuid,text,text) to authenticated;

create or replace function public.draw_next_number(target_session_id uuid) returns integer
language plpgsql security definer set search_path=public as $$
declare
  s public.draw_sessions%rowtype;
  next_number integer;
  next_sequence integer;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into s from public.draw_sessions where id=target_session_id for update;
  if s.id is null then raise exception 'draw session not found'; end if;
  if not public.has_workspace_role(s.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) then raise exception 'access denied'; end if;
  if s.status <> 'active' then raise exception 'draw session is not active'; end if;
  if s.called_count >= s.total_balls then raise exception 'all numbers have already been called'; end if;

  select n into next_number
  from generate_series(1,s.total_balls) n
  where not exists(select 1 from public.draw_numbers dn where dn.session_id=s.id and dn.number=n and dn.status='called')
  order by random()
  limit 1;
  if next_number is null then raise exception 'no available number'; end if;

  select coalesce(max(sequence_number),0)+1 into next_sequence from public.draw_numbers where session_id=s.id;
  insert into public.draw_numbers(workspace_id,event_id,session_id,number,sequence_number,status)
    values(s.workspace_id,s.event_id,s.id,next_number,next_sequence,'called');
  update public.draw_sessions set called_count=called_count+1,last_called_number=next_number,updated_at=now() where id=s.id;
  perform public.log_audit(s.workspace_id,'draw.number_called','draw_session',s.id::text,
    jsonb_build_object('event_id',s.event_id,'number',next_number,'sequence',next_sequence));
  return next_number;
end; $$;
revoke all on function public.draw_next_number(uuid) from public;
grant execute on function public.draw_next_number(uuid) to authenticated;

create or replace function public.pause_draw_session(target_session_id uuid) returns void
language plpgsql security definer set search_path=public as $$
declare s public.draw_sessions%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into s from public.draw_sessions where id=target_session_id for update;
  if s.id is null then raise exception 'draw session not found'; end if;
  if not public.has_workspace_role(s.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) then raise exception 'access denied'; end if;
  if s.status <> 'active' then raise exception 'only an active draw can be paused'; end if;
  update public.draw_sessions set status='paused',paused_at=now(),updated_at=now() where id=s.id;
  update public.events set status='paused',updated_at=now() where id=s.event_id;
  perform public.log_audit(s.workspace_id,'draw.paused','draw_session',s.id::text,jsonb_build_object('event_id',s.event_id));
end; $$;
revoke all on function public.pause_draw_session(uuid) from public;
grant execute on function public.pause_draw_session(uuid) to authenticated;

create or replace function public.resume_draw_session(target_session_id uuid) returns void
language plpgsql security definer set search_path=public as $$
declare s public.draw_sessions%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into s from public.draw_sessions where id=target_session_id for update;
  if s.id is null then raise exception 'draw session not found'; end if;
  if not public.has_workspace_role(s.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) then raise exception 'access denied'; end if;
  if s.status <> 'paused' then raise exception 'only a paused draw can be resumed'; end if;
  update public.draw_sessions set status='active',paused_at=null,updated_at=now() where id=s.id;
  update public.events set status='drawing',updated_at=now() where id=s.event_id;
  perform public.log_audit(s.workspace_id,'draw.resumed','draw_session',s.id::text,jsonb_build_object('event_id',s.event_id));
end; $$;
revoke all on function public.resume_draw_session(uuid) from public;
grant execute on function public.resume_draw_session(uuid) to authenticated;

create or replace function public.undo_last_draw_number(target_session_id uuid,reason text default null) returns integer
language plpgsql security definer set search_path=public as $$
declare
  s public.draw_sessions%rowtype;
  dn public.draw_numbers%rowtype;
  previous_number integer;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into s from public.draw_sessions where id=target_session_id for update;
  if s.id is null then raise exception 'draw session not found'; end if;
  if not public.has_workspace_role(s.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) then raise exception 'access denied'; end if;
  if s.status not in ('active','paused') then raise exception 'draw is not open'; end if;

  select * into dn from public.draw_numbers where session_id=s.id and status='called' order by sequence_number desc limit 1 for update;
  if dn.id is null then raise exception 'there is no called number to undo'; end if;
  update public.draw_numbers set status='voided',voided_by=auth.uid(),voided_at=now(),void_reason=left(nullif(trim(reason),''),500) where id=dn.id;
  select number into previous_number from public.draw_numbers where session_id=s.id and status='called' order by sequence_number desc limit 1;
  update public.draw_sessions set called_count=greatest(0,called_count-1),last_called_number=previous_number,updated_at=now() where id=s.id;
  perform public.log_audit(s.workspace_id,'draw.number_voided','draw_session',s.id::text,
    jsonb_build_object('event_id',s.event_id,'number',dn.number,'sequence',dn.sequence_number,'reason',reason));
  return dn.number;
end; $$;
revoke all on function public.undo_last_draw_number(uuid,text) from public;
grant execute on function public.undo_last_draw_number(uuid,text) to authenticated;

create or replace function public.finish_draw_session(target_session_id uuid,finish_event boolean default true) returns void
language plpgsql security definer set search_path=public as $$
declare s public.draw_sessions%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into s from public.draw_sessions where id=target_session_id for update;
  if s.id is null then raise exception 'draw session not found'; end if;
  if not public.has_workspace_role(s.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) then raise exception 'access denied'; end if;
  if s.status not in ('active','paused') then raise exception 'draw is not open'; end if;
  update public.draw_sessions set status='finished',finished_at=now(),paused_at=null,updated_at=now() where id=s.id;
  update public.events set status=case when finish_event then 'finished'::public.event_status else 'ready'::public.event_status end,updated_at=now() where id=s.event_id;
  perform public.log_audit(s.workspace_id,'draw.finished','draw_session',s.id::text,
    jsonb_build_object('event_id',s.event_id,'called_count',s.called_count,'finish_event',finish_event));
end; $$;
revoke all on function public.finish_draw_session(uuid,boolean) from public;
grant execute on function public.finish_draw_session(uuid,boolean) to authenticated;

create or replace function public.cancel_draw_session(target_session_id uuid,reason text default null) returns void
language plpgsql security definer set search_path=public as $$
declare s public.draw_sessions%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into s from public.draw_sessions where id=target_session_id for update;
  if s.id is null then raise exception 'draw session not found'; end if;
  if not public.has_workspace_role(s.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) then raise exception 'access denied'; end if;
  if s.status not in ('active','paused') then raise exception 'draw is not open'; end if;
  update public.draw_sessions set status='canceled',canceled_at=now(),paused_at=null,updated_at=now() where id=s.id;
  update public.events set status='ready',updated_at=now() where id=s.event_id;
  perform public.log_audit(s.workspace_id,'draw.canceled','draw_session',s.id::text,jsonb_build_object('event_id',s.event_id,'reason',reason));
end; $$;
revoke all on function public.cancel_draw_session(uuid,text) from public;
grant execute on function public.cancel_draw_session(uuid,text) to authenticated;

create trigger draw_sessions_set_updated_at before update on public.draw_sessions for each row execute function public.set_updated_at();

-- Prepara Realtime para operador/painel. Ignora caso as tabelas já estejam na publication.
do $$ begin
  alter publication supabase_realtime add table public.draw_sessions;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.draw_numbers;
exception when duplicate_object then null;
end $$;
