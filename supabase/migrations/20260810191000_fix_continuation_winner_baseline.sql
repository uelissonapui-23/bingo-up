-- Corrige falsos vencedores ao iniciar uma nova premiação com bolas continuadas.
-- Regra operacional: uma nova premiação só pode produzir candidato quando uma NOVA bola
-- fizer o jogo passar de incompleto para completo para o padrão dessa rodada.

alter table public.draw_session_games
  add column if not exists completed_at_round_start boolean not null default false;

create index if not exists draw_session_games_round_start_idx
  on public.draw_session_games(session_id,completed_at_round_start);

-- Proteção adicional: jogos que já completavam o padrão no instante em que a rodada
-- continuada começou não podem ser recriados como candidatos por refresh/undo/reavaliação.
create or replace function public.guard_round_start_completed_candidate() returns trigger
language plpgsql security definer set search_path=public as $$
declare blocked boolean:=false;
begin
  if new.status <> 'detected' then return new; end if;
  select coalesce(dsg.completed_at_round_start,false) into blocked
  from public.draw_session_games dsg
  where dsg.session_id=new.session_id and dsg.card_game_id=new.card_game_id
  limit 1;
  if blocked then
    if tg_op='UPDATE' then return old; end if;
    return null;
  end if;
  return new;
end; $$;

drop trigger if exists winner_candidate_round_start_guard on public.winner_candidates;
create trigger winner_candidate_round_start_guard
before insert or update of status on public.winner_candidates
for each row execute function public.guard_round_start_completed_candidate();

create or replace function public.evaluate_draw_number_impact(target_session_id uuid,target_number integer) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  s public.draw_sessions%rowtype;
  gp record;
  pattern_kind text;
  target_index integer;
  called integer[];
  nums integer[];
  cells jsonb;
  rows_count integer;
  cols_count integer;
  missing integer;
  matched integer;
  previous_missing integer;
  row_missing integer[];
  col_missing integer[];
  diag_main_missing integer;
  diag_secondary_missing integer;
  r integer;
  c integer;
  idx integer;
  cell jsonb;
  value integer;
  trigger_id uuid;
  affected integer:=0;
  one_away integer;
  two_away integer;
  winners integer;
begin
  select * into s from public.draw_sessions where id=target_session_id;
  if s.id is null then raise exception 'draw session not found'; end if;
  if auth.uid() is not null and not public.is_workspace_member(s.workspace_id) then raise exception 'access denied'; end if;

  pattern_kind:=coalesce(s.win_pattern_snapshot->>'kind','full_card');
  target_index:=coalesce((s.win_pattern_snapshot->>'target_index')::integer,0);
  rows_count:=coalesce((s.rule_snapshot->>'grid_rows')::integer,5);
  cols_count:=coalesce((s.rule_snapshot->>'grid_columns')::integer,5);

  select coalesce(array_agg(number order by number),'{}'::integer[])
    into called from public.draw_numbers where session_id=s.id and status='called';
  select id into trigger_id from public.draw_numbers where session_id=s.id and status='called' order by sequence_number desc limit 1;

  for gp in
    select dsg.*,gd.numbers,gd.cells
    from public.draw_session_games dsg
    join public.game_definitions gd on gd.id=dsg.game_definition_id
    where dsg.session_id=s.id and target_number=any(gd.numbers)
  loop
    affected:=affected+1;
    select missing_count into previous_missing
      from public.game_progress
      where session_id=s.id and card_game_id=gp.card_game_id;

    nums:=gp.numbers;
    cells:=gp.cells;
    matched:=(select count(*) from unnest(nums) n where n=any(called));

    row_missing:='{}'::integer[];
    for r in 0..rows_count-1 loop
      missing:=0;
      for c in 0..cols_count-1 loop
        idx:=r*cols_count+c;
        cell:=cells->idx;
        if cell is not null and jsonb_typeof(cell)<>'null' then
          value:=(cell::text)::integer;
          if not(value=any(called)) then missing:=missing+1; end if;
        end if;
      end loop;
      row_missing:=array_append(row_missing,missing);
    end loop;

    col_missing:='{}'::integer[];
    for c in 0..cols_count-1 loop
      missing:=0;
      for r in 0..rows_count-1 loop
        idx:=r*cols_count+c;
        cell:=cells->idx;
        if cell is not null and jsonb_typeof(cell)<>'null' then
          value:=(cell::text)::integer;
          if not(value=any(called)) then missing:=missing+1; end if;
        end if;
      end loop;
      col_missing:=array_append(col_missing,missing);
    end loop;

    diag_main_missing:=0;
    diag_secondary_missing:=0;
    if rows_count=cols_count then
      for r in 0..rows_count-1 loop
        cell:=cells->(r*cols_count+r);
        if cell is not null and jsonb_typeof(cell)<>'null' then
          value:=(cell::text)::integer;
          if not(value=any(called)) then diag_main_missing:=diag_main_missing+1; end if;
        end if;
        cell:=cells->(r*cols_count+(cols_count-1-r));
        if cell is not null and jsonb_typeof(cell)<>'null' then
          value:=(cell::text)::integer;
          if not(value=any(called)) then diag_secondary_missing:=diag_secondary_missing+1; end if;
        end if;
      end loop;
    else
      diag_main_missing:=999;
      diag_secondary_missing:=999;
    end if;

    if pattern_kind='full_card' then
      missing:=cardinality(nums)-matched;
    elsif pattern_kind='line' then
      select min(x) into missing from unnest(row_missing) x;
    elsif pattern_kind='two_lines' then
      select coalesce(sum(x),0)::integer into missing from (select x from unnest(row_missing) x order by x limit 2) q;
    elsif pattern_kind='any_line' then
      select min(x) into missing from unnest(row_missing||col_missing||array[diag_main_missing,diag_secondary_missing]) x;
    elsif pattern_kind='specific_row' then
      if target_index<0 or target_index>=rows_count then missing:=999; else missing:=row_missing[target_index+1]; end if;
    elsif pattern_kind='any_column' then
      select min(x) into missing from unnest(col_missing) x;
    elsif pattern_kind='specific_column' then
      if target_index<0 or target_index>=cols_count then missing:=999; else missing:=col_missing[target_index+1]; end if;
    elsif pattern_kind='any_diagonal' then
      missing:=least(diag_main_missing,diag_secondary_missing);
    elsif pattern_kind='diagonal_main' then
      missing:=diag_main_missing;
    elsif pattern_kind='diagonal_secondary' then
      missing:=diag_secondary_missing;
    elsif pattern_kind='four_corners' then
      missing:=0;
      foreach idx in array array[0,cols_count-1,(rows_count-1)*cols_count,rows_count*cols_count-1] loop
        cell:=cells->idx;
        if cell is not null and jsonb_typeof(cell)<>'null' then
          value:=(cell::text)::integer;
          if not(value=any(called)) then missing:=missing+1; end if;
        end if;
      end loop;
    else
      missing:=cardinality(nums)-matched;
    end if;

    insert into public.game_progress(session_id,workspace_id,event_id,physical_card_id,card_game_id,game_definition_id,position,matched_count,missing_count,is_winner,completed_at,last_evaluated_at)
    values(s.id,s.workspace_id,s.event_id,gp.physical_card_id,gp.card_game_id,gp.game_definition_id,gp.position,matched,missing,missing=0,case when missing=0 then now() else null end,now())
    on conflict(session_id,card_game_id) do update set
      matched_count=excluded.matched_count,
      missing_count=excluded.missing_count,
      is_winner=excluded.is_winner,
      completed_at=case when excluded.is_winner then coalesce(public.game_progress.completed_at,now()) else null end,
      last_evaluated_at=now();

    -- Só nasce um candidato quando ESTA bola causou a transição para vencedor.
    if missing=0
       and coalesce(previous_missing,1)>0
       and not coalesce(gp.completed_at_round_start,false) then
      insert into public.winner_candidates(workspace_id,event_id,session_id,physical_card_id,card_game_id,game_definition_id,trigger_draw_number_id,status)
      values(s.workspace_id,s.event_id,s.id,gp.physical_card_id,gp.card_game_id,gp.game_definition_id,trigger_id,'detected')
      on conflict(session_id,card_game_id) do update set
        status=case when public.winner_candidates.status='invalidated' then 'detected'::public.winner_candidate_status else public.winner_candidates.status end,
        trigger_draw_number_id=coalesce(public.winner_candidates.trigger_draw_number_id,excluded.trigger_draw_number_id),
        detected_at=case when public.winner_candidates.status='invalidated' then now() else public.winner_candidates.detected_at end;
    end if;
  end loop;

  select count(*) into one_away from public.game_progress where session_id=s.id and missing_count=1;
  select count(*) into two_away from public.game_progress where session_id=s.id and missing_count=2;
  select count(*) into winners from public.game_progress where session_id=s.id and is_winner and not exists(
    select 1 from public.draw_session_games dsg where dsg.session_id=s.id and dsg.card_game_id=game_progress.card_game_id and dsg.completed_at_round_start
  );
  return jsonb_build_object('one_away',one_away,'two_away',two_away,'winners',winners,'affected_games',affected);
end; $$;
revoke all on function public.evaluate_draw_number_impact(uuid,integer) from public;
grant execute on function public.evaluate_draw_number_impact(uuid,integer) to authenticated;

create or replace function public.create_draw_session(
  target_event_id uuid,
  target_rule_set_id uuid default null,
  target_win_pattern_code text default null,
  target_name text default null,
  target_continue_numbers boolean default false,
  target_draw_method text default 'automatic',
  target_exclude_previously_awarded_games boolean default false
) returns uuid
language plpgsql security definer set search_path=public as $$
declare
  e public.events%rowtype;
  r public.bingo_rule_sets%rowtype;
  previous_session public.draw_sessions%rowtype;
  new_id uuid;
  next_session integer;
  pattern jsonb;
  sold_card_count integer;
  card_count integer:=0;
  game_count integer:=0;
  carried_count integer:=0;
  carried_last integer;
  progress_result jsonb;
  effective_exclusion boolean:=false;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if target_draw_method not in ('automatic','manual') then raise exception 'invalid draw method'; end if;

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

  if target_win_pattern_code is null then pattern:=r.win_patterns->0;
  else select p.value into pattern from jsonb_array_elements(r.win_patterns) p(value) where p.value->>'code'=target_win_pattern_code limit 1;
  end if;
  if pattern is null then raise exception 'win pattern not found'; end if;

  select coalesce(max(session_number),0)+1 into next_session from public.draw_sessions where event_id=e.id;
  select count(*) into sold_card_count from public.physical_cards where event_id=e.id and status='sold';
  if sold_card_count=0 then raise exception 'at least one sold card is required to start the draw'; end if;

  if target_continue_numbers then
    select * into previous_session from public.draw_sessions where event_id=e.id and status='finished' order by session_number desc limit 1;
    if previous_session.id is null then raise exception 'there is no finished round to continue'; end if;
    if previous_session.total_balls<>r.total_balls then raise exception 'the previous round uses a different number of balls'; end if;
  end if;

  effective_exclusion:=target_continue_numbers or target_exclude_previously_awarded_games;

  insert into public.draw_sessions(
    workspace_id,event_id,rule_set_id,session_number,name,status,total_balls,
    win_pattern_code,win_pattern_snapshot,rule_snapshot,participant_cards,participant_games,
    draw_method,continues_previous,continuation_source_session_id,exclude_previously_awarded_games
  ) values (
    e.workspace_id,e.id,r.id,next_session,coalesce(nullif(trim(target_name),''),'Rodada '||next_session::text),'active',r.total_balls,
    pattern->>'code',pattern,
    jsonb_build_object('name',r.name,'code',r.code,'total_balls',r.total_balls,'grid_rows',r.grid_rows,'grid_columns',r.grid_columns,
      'numbers_per_game',r.numbers_per_game,'free_center',r.free_center,'distribution_mode',r.distribution_mode,
      'column_definitions',r.column_definitions,'win_patterns',r.win_patterns),
    0,0,target_draw_method,target_continue_numbers,case when target_continue_numbers then previous_session.id else null end,effective_exclusion
  ) returning id into new_id;

  insert into public.draw_session_games(session_id,workspace_id,event_id,physical_card_id,card_game_id,game_definition_id,position)
    select new_id,e.workspace_id,e.id,pc.id,cg.id,cg.game_definition_id,cg.position
    from public.physical_cards pc
    join public.card_games cg on cg.physical_card_id=pc.id
    where pc.event_id=e.id and pc.workspace_id=e.workspace_id and pc.status='sold'
      and (not effective_exclusion or not exists(select 1 from public.winners w where w.event_id=e.id and w.card_game_id=cg.id));

  select count(distinct physical_card_id),count(*) into card_count,game_count from public.draw_session_games where session_id=new_id;
  if game_count=0 then delete from public.draw_sessions where id=new_id; raise exception 'no eligible sold games remain for this prize'; end if;
  update public.draw_sessions set participant_cards=card_count,participant_games=game_count where id=new_id;

  if target_continue_numbers then
    insert into public.draw_numbers(workspace_id,event_id,session_id,number,sequence_number,status,called_by,called_at)
      select e.workspace_id,e.id,new_id,dn.number,dn.sequence_number,'called',auth.uid(),now()
      from public.draw_numbers dn where dn.session_id=previous_session.id and dn.status='called' order by dn.sequence_number;

    select count(*) into carried_count from public.draw_numbers where session_id=new_id and status='called';
    select number into carried_last from public.draw_numbers where session_id=new_id and status='called' order by sequence_number desc limit 1;
    update public.draw_sessions set called_count=carried_count,last_called_number=carried_last,updated_at=now() where id=new_id;

    -- Calcula apenas a linha de base da nova premiação. Qualquer jogo que já estava
    -- completo antes de sair uma nova bola é marcado e NÃO vira candidato desta rodada.
    progress_result:=public.evaluate_draw_session_progress(new_id);
    update public.draw_session_games dsg
      set completed_at_round_start=true
      from public.game_progress gp
      where gp.session_id=new_id and gp.card_game_id=dsg.card_game_id and dsg.session_id=new_id and gp.missing_count=0;
    delete from public.winner_candidates where session_id=new_id;
    update public.events set status='drawing',updated_at=now() where id=e.id;
  else
    update public.events set status='drawing',updated_at=now() where id=e.id;
  end if;

  perform public.log_audit(e.workspace_id,'draw.started','draw_session',new_id::text,
    jsonb_build_object('event_id',e.id,'session_number',next_session,'sold_cards',sold_card_count,
      'participant_cards',card_count,'participant_games',game_count,'win_pattern',pattern->>'code',
      'draw_method',target_draw_method,'continues_previous',target_continue_numbers,
      'exclude_previously_awarded_games',effective_exclusion,'carried_numbers',carried_count,
      'baseline_completed_games',(select count(*) from public.draw_session_games where session_id=new_id and completed_at_round_start),
      'progress',progress_result));
  return new_id;
end; $$;
revoke all on function public.create_draw_session(uuid,uuid,text,text,boolean,text,boolean) from public;
grant execute on function public.create_draw_session(uuid,uuid,text,text,boolean,text,boolean) to authenticated;
