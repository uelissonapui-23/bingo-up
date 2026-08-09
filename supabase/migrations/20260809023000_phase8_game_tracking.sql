-- Fase 8: acompanhamento automático dos jogos participantes e detecção de possíveis vencedores.
-- O cálculo ocorre no banco após sorteio/anulação para manter uma única fonte de verdade.

create type public.winner_candidate_status as enum ('detected','confirmed','dismissed','invalidated');

create table public.game_progress (
  session_id uuid not null references public.draw_sessions(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  physical_card_id uuid not null references public.physical_cards(id) on delete restrict,
  card_game_id uuid not null references public.card_games(id) on delete restrict,
  game_definition_id uuid not null references public.game_definitions(id) on delete restrict,
  position smallint not null check(position between 1 and 6),
  matched_count integer not null default 0 check(matched_count>=0),
  missing_count integer not null default 0 check(missing_count>=0),
  is_winner boolean not null default false,
  completed_at timestamptz,
  last_evaluated_at timestamptz not null default now(),
  primary key(session_id,card_game_id)
);
create index game_progress_distance_idx on public.game_progress(session_id,missing_count,is_winner);
create index game_progress_card_idx on public.game_progress(session_id,physical_card_id,position);

create table public.winner_candidates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  session_id uuid not null references public.draw_sessions(id) on delete cascade,
  physical_card_id uuid not null references public.physical_cards(id) on delete restrict,
  card_game_id uuid not null references public.card_games(id) on delete restrict,
  game_definition_id uuid not null references public.game_definitions(id) on delete restrict,
  trigger_draw_number_id uuid references public.draw_numbers(id) on delete set null,
  status public.winner_candidate_status not null default 'detected',
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  resolution_note text,
  created_at timestamptz not null default now(),
  unique(session_id,card_game_id)
);
create index winner_candidates_session_idx on public.winner_candidates(session_id,status,detected_at);
create index winner_candidates_card_idx on public.winner_candidates(session_id,physical_card_id);

alter table public.game_progress enable row level security;
alter table public.winner_candidates enable row level security;
create policy game_progress_member_select on public.game_progress for select to authenticated using(public.is_workspace_member(workspace_id));
create policy winner_candidates_member_select on public.winner_candidates for select to authenticated using(public.is_workspace_member(workspace_id));

create or replace function public.evaluate_draw_session_progress(target_session_id uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  s public.draw_sessions%rowtype;
  pattern_kind text;
  rows_count integer;
  cols_count integer;
  called integer[];
  gp record;
  cells jsonb;
  nums smallint[];
  missing integer;
  matched integer;
  row_missing integer[];
  r integer;
  c integer;
  cell jsonb;
  value integer;
  trigger_id uuid;
  one_away integer;
  two_away integer;
  winners integer;
begin
  select * into s from public.draw_sessions where id=target_session_id;
  if s.id is null then raise exception 'draw session not found'; end if;
  if auth.uid() is not null and not public.is_workspace_member(s.workspace_id) then raise exception 'access denied'; end if;
  pattern_kind:=coalesce(s.win_pattern_snapshot->>'kind','full_card');
  rows_count:=coalesce((s.rule_snapshot->>'grid_rows')::integer,5);
  cols_count:=coalesce((s.rule_snapshot->>'grid_columns')::integer,5);
  select coalesce(array_agg(number order by number),'{}'::integer[]) into called from public.draw_numbers where session_id=s.id and status='called';
  select id into trigger_id from public.draw_numbers where session_id=s.id and status='called' order by sequence_number desc limit 1;

  for gp in
    select dsg.*,gd.numbers,gd.cells from public.draw_session_games dsg join public.game_definitions gd on gd.id=dsg.game_definition_id where dsg.session_id=s.id
  loop
    nums:=gp.numbers; cells:=gp.cells;
    matched:=(select count(*) from unnest(nums) n where n=any(called));
    if pattern_kind='full_card' then
      missing:=cardinality(nums)-matched;
    elsif pattern_kind in ('line','two_lines') then
      row_missing:='{}'::integer[];
      for r in 0..rows_count-1 loop
        missing:=0;
        for c in 0..cols_count-1 loop
          cell:=cells->(r*cols_count+c);
          if cell is not null and jsonb_typeof(cell)<>'null' then
            value:=(cell::text)::integer;
            if not(value=any(called)) then missing:=missing+1; end if;
          end if;
        end loop;
        row_missing:=array_append(row_missing,missing);
      end loop;
      select min(x) into missing from unnest(row_missing) x;
      if pattern_kind='two_lines' then
        select coalesce(sum(x),0)::integer into missing from (select x from unnest(row_missing) x order by x limit 2) q;
      end if;
    else
      -- Padrões personalizados ainda não têm geometria própria; usa cartela cheia de forma conservadora.
      missing:=cardinality(nums)-matched;
    end if;

    insert into public.game_progress(session_id,workspace_id,event_id,physical_card_id,card_game_id,game_definition_id,position,matched_count,missing_count,is_winner,completed_at,last_evaluated_at)
    values(s.id,s.workspace_id,s.event_id,gp.physical_card_id,gp.card_game_id,gp.game_definition_id,gp.position,matched,missing,missing=0,case when missing=0 then now() else null end,now())
    on conflict(session_id,card_game_id) do update set matched_count=excluded.matched_count,missing_count=excluded.missing_count,is_winner=excluded.is_winner,completed_at=case when excluded.is_winner then coalesce(public.game_progress.completed_at,now()) else null end,last_evaluated_at=now();

    if missing=0 then
      insert into public.winner_candidates(workspace_id,event_id,session_id,physical_card_id,card_game_id,game_definition_id,trigger_draw_number_id,status)
      values(s.workspace_id,s.event_id,s.id,gp.physical_card_id,gp.card_game_id,gp.game_definition_id,trigger_id,'detected')
      on conflict(session_id,card_game_id) do update set status=case when public.winner_candidates.status='invalidated' then 'detected'::public.winner_candidate_status else public.winner_candidates.status end,trigger_draw_number_id=coalesce(public.winner_candidates.trigger_draw_number_id,excluded.trigger_draw_number_id),detected_at=case when public.winner_candidates.status='invalidated' then now() else public.winner_candidates.detected_at end;
    else
      update public.winner_candidates set status='invalidated',resolved_at=now(),resolution_note='O jogo deixou de completar o padrão após alteração do sorteio.' where session_id=s.id and card_game_id=gp.card_game_id and status='detected';
    end if;
  end loop;
  select count(*) into one_away from public.game_progress where session_id=s.id and missing_count=1;
  select count(*) into two_away from public.game_progress where session_id=s.id and missing_count=2;
  select count(*) into winners from public.game_progress where session_id=s.id and is_winner;
  return jsonb_build_object('one_away',one_away,'two_away',two_away,'winners',winners,'evaluated_games',s.participant_games);
end; $$;
revoke all on function public.evaluate_draw_session_progress(uuid) from public;
grant execute on function public.evaluate_draw_session_progress(uuid) to authenticated;

-- Inicializa o progresso no começo da rodada.
create or replace function public.initialize_draw_progress() returns trigger language plpgsql security definer set search_path=public as $$
begin
  perform public.evaluate_draw_session_progress(new.id);
  return new;
end; $$;
-- A sessão é inserida antes do snapshot de jogos, então a avaliação útil é disparada pelo último passo da RPC abaixo.

-- Recria as duas operações que alteram bolas para recalcular o progresso atomicamente.
create or replace function public.draw_next_number(target_session_id uuid) returns integer
language plpgsql security definer set search_path=public as $$
declare s public.draw_sessions%rowtype; next_number integer; next_sequence integer;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into s from public.draw_sessions where id=target_session_id for update;
  if s.id is null then raise exception 'draw session not found'; end if;
  if not public.has_workspace_role(s.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) then raise exception 'access denied'; end if;
  if s.status<>'active' then raise exception 'draw session is not active'; end if;
  if s.called_count>=s.total_balls then raise exception 'all numbers have already been called'; end if;
  select n into next_number from generate_series(1,s.total_balls)n where not exists(select 1 from public.draw_numbers dn where dn.session_id=s.id and dn.number=n and dn.status='called') order by random() limit 1;
  if next_number is null then raise exception 'no available number'; end if;
  select coalesce(max(sequence_number),0)+1 into next_sequence from public.draw_numbers where session_id=s.id;
  insert into public.draw_numbers(workspace_id,event_id,session_id,number,sequence_number,status) values(s.workspace_id,s.event_id,s.id,next_number,next_sequence,'called');
  update public.draw_sessions set called_count=called_count+1,last_called_number=next_number,updated_at=now() where id=s.id;
  perform public.evaluate_draw_session_progress(s.id);
  perform public.log_audit(s.workspace_id,'draw.number_called','draw_session',s.id::text,jsonb_build_object('event_id',s.event_id,'number',next_number,'sequence',next_sequence));
  return next_number;
end; $$;
revoke all on function public.draw_next_number(uuid) from public; grant execute on function public.draw_next_number(uuid) to authenticated;

create or replace function public.undo_last_draw_number(target_session_id uuid,reason text default null) returns integer
language plpgsql security definer set search_path=public as $$
declare s public.draw_sessions%rowtype; dn public.draw_numbers%rowtype; previous_number integer;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into s from public.draw_sessions where id=target_session_id for update;
  if s.id is null then raise exception 'draw session not found'; end if;
  if not public.has_workspace_role(s.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) then raise exception 'access denied'; end if;
  if s.status not in('active','paused') then raise exception 'draw is not open'; end if;
  select * into dn from public.draw_numbers where session_id=s.id and status='called' order by sequence_number desc limit 1 for update;
  if dn.id is null then raise exception 'there is no called number to undo'; end if;
  update public.draw_numbers set status='voided',voided_by=auth.uid(),voided_at=now(),void_reason=left(nullif(trim(reason),''),500) where id=dn.id;
  select number into previous_number from public.draw_numbers where session_id=s.id and status='called' order by sequence_number desc limit 1;
  update public.draw_sessions set called_count=greatest(0,called_count-1),last_called_number=previous_number,updated_at=now() where id=s.id;
  perform public.evaluate_draw_session_progress(s.id);
  perform public.log_audit(s.workspace_id,'draw.number_voided','draw_session',s.id::text,jsonb_build_object('event_id',s.event_id,'number',dn.number,'sequence',dn.sequence_number,'reason',reason));
  return dn.number;
end; $$;
revoke all on function public.undo_last_draw_number(uuid,text) from public; grant execute on function public.undo_last_draw_number(uuid,text) to authenticated;

-- Recalcula uma primeira vez após a criação da sessão (snapshot já existente ao fim da RPC).
create or replace function public.refresh_draw_progress(target_session_id uuid) returns jsonb
language plpgsql security definer set search_path=public as $$ begin return public.evaluate_draw_session_progress(target_session_id); end; $$;
revoke all on function public.refresh_draw_progress(uuid) from public; grant execute on function public.refresh_draw_progress(uuid) to authenticated;

alter publication supabase_realtime add table public.game_progress;
alter publication supabase_realtime add table public.winner_candidates;
