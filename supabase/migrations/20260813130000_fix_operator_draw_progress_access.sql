-- Corrige o erro 'access denied' depois que o operador cria a rodada.
-- A RPC refresh_draw_progress já aceitava operador, mas as funções internas de avaliação
-- ainda exigiam is_workspace_member(), papel que o operador multi-papel não deve receber.

create or replace function public.evaluate_draw_session_progress(target_session_id uuid) returns jsonb
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
  one_away integer;
  two_away integer;
  winners integer;
begin
  select * into s from public.draw_sessions where id=target_session_id;
  if s.id is null then raise exception 'draw session not found'; end if;
  if auth.uid() is not null and not public.has_workspace_role(s.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) and not public.draw_operator_has_event_access(s.event_id) then raise exception 'access denied'; end if;

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
    where dsg.session_id=s.id
  loop
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

    if missing=0 then
      insert into public.winner_candidates(workspace_id,event_id,session_id,physical_card_id,card_game_id,game_definition_id,trigger_draw_number_id,status)
      values(s.workspace_id,s.event_id,s.id,gp.physical_card_id,gp.card_game_id,gp.game_definition_id,trigger_id,'detected')
      on conflict(session_id,card_game_id) do update set
        status=case when public.winner_candidates.status='invalidated' then 'detected'::public.winner_candidate_status else public.winner_candidates.status end,
        trigger_draw_number_id=coalesce(public.winner_candidates.trigger_draw_number_id,excluded.trigger_draw_number_id),
        detected_at=case when public.winner_candidates.status='invalidated' then now() else public.winner_candidates.detected_at end;
    else
      update public.winner_candidates
      set status='invalidated',resolved_at=now(),resolution_note='O jogo deixou de completar o padrão após alteração do sorteio.'
      where session_id=s.id and card_game_id=gp.card_game_id and status='detected';
    end if;
  end loop;

  select count(*) into one_away from public.game_progress where session_id=s.id and missing_count=1;
  select count(*) into two_away from public.game_progress where session_id=s.id and missing_count=2;
  select count(*) into winners from public.game_progress where session_id=s.id and is_winner;
  return jsonb_build_object('one_away',one_away,'two_away',two_away,'winners',winners,'evaluated_games',s.participant_games);
end; $$;
revoke all on function public.evaluate_draw_session_progress(uuid) from public;
grant execute on function public.evaluate_draw_session_progress(uuid) to authenticated;

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
  if auth.uid() is not null and not public.has_workspace_role(s.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) and not public.draw_operator_has_event_access(s.event_id) then raise exception 'access denied'; end if;

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
