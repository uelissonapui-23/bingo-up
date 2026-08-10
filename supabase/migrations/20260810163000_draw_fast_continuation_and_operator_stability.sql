-- Operação de sorteio mais rápida e estável.
-- 1) Mantém continuidade entre premiações sem devolver bolas.
-- 2) Avalia somente os jogos afetados pela nova bola, em vez de recalcular todos os jogos.
-- 3) Preserva a mesma fonte de verdade para operador, conferência e painel público.

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
    end if;
  end loop;

  select count(*) into one_away from public.game_progress where session_id=s.id and missing_count=1;
  select count(*) into two_away from public.game_progress where session_id=s.id and missing_count=2;
  select count(*) into winners from public.game_progress where session_id=s.id and is_winner;
  return jsonb_build_object('one_away',one_away,'two_away',two_away,'winners',winners,'affected_games',affected);
end; $$;
revoke all on function public.evaluate_draw_number_impact(uuid,integer) from public;
grant execute on function public.evaluate_draw_number_impact(uuid,integer) to authenticated;

create or replace function public.call_manual_draw_number(target_session_id uuid,target_number integer) returns integer
language plpgsql security definer set search_path=public as $$
declare
  s public.draw_sessions%rowtype;
  next_sequence integer;
  progress_result jsonb;
  has_candidate boolean;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into s from public.draw_sessions where id=target_session_id for update;
  if s.id is null then raise exception 'draw session not found'; end if;
  if not public.has_workspace_role(s.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) then raise exception 'access denied'; end if;
  if s.status<>'active' then raise exception 'draw session is not active'; end if;
  if s.draw_method<>'manual' then raise exception 'this round is not configured for manual calls'; end if;
  if target_number<1 or target_number>s.total_balls then raise exception 'number is outside the valid range'; end if;
  if exists(select 1 from public.draw_numbers where session_id=s.id and number=target_number and status='called') then raise exception 'number has already been called'; end if;
  if s.called_count>=s.total_balls then raise exception 'all numbers have already been called'; end if;

  select coalesce(max(sequence_number),0)+1 into next_sequence from public.draw_numbers where session_id=s.id;
  insert into public.draw_numbers(workspace_id,event_id,session_id,number,sequence_number,status)
    values(s.workspace_id,s.event_id,s.id,target_number,next_sequence,'called');
  update public.draw_sessions set called_count=called_count+1,last_called_number=target_number,updated_at=now() where id=s.id;

  progress_result:=public.evaluate_draw_number_impact(s.id,target_number);
  select exists(select 1 from public.winner_candidates where session_id=s.id and status='detected') into has_candidate;
  if has_candidate then
    update public.draw_sessions set status='paused',paused_at=now(),updated_at=now() where id=s.id;
    update public.events set status='paused',updated_at=now() where id=s.event_id;
    perform public.log_audit(s.workspace_id,'draw.auto_paused_for_winner','draw_session',s.id::text,
      jsonb_build_object('event_id',s.event_id,'number',target_number,'sequence',next_sequence,'progress',progress_result,'manual',true));
  end if;

  perform public.log_audit(s.workspace_id,'draw.number_called_manual','draw_session',s.id::text,
    jsonb_build_object('event_id',s.event_id,'number',target_number,'sequence',next_sequence,'affected_games',progress_result->'affected_games'));
  return target_number;
end; $$;
revoke all on function public.call_manual_draw_number(uuid,integer) from public;
grant execute on function public.call_manual_draw_number(uuid,integer) to authenticated;

create or replace function public.draw_next_number(target_session_id uuid) returns integer
language plpgsql security definer set search_path=public as $$
declare
  s public.draw_sessions%rowtype;
  next_number integer;
  next_sequence integer;
  progress_result jsonb;
  has_candidate boolean;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into s from public.draw_sessions where id=target_session_id for update;
  if s.id is null then raise exception 'draw session not found'; end if;
  if not public.has_workspace_role(s.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) then raise exception 'access denied'; end if;
  if s.status<>'active' then raise exception 'draw session is not active'; end if;
  if s.called_count>=s.total_balls then raise exception 'all numbers have already been called'; end if;

  select n into next_number from generate_series(1,s.total_balls)n
  where not exists(select 1 from public.draw_numbers dn where dn.session_id=s.id and dn.number=n and dn.status='called')
  order by random() limit 1;
  if next_number is null then raise exception 'no available number'; end if;

  select coalesce(max(sequence_number),0)+1 into next_sequence from public.draw_numbers where session_id=s.id;
  insert into public.draw_numbers(workspace_id,event_id,session_id,number,sequence_number,status)
    values(s.workspace_id,s.event_id,s.id,next_number,next_sequence,'called');
  update public.draw_sessions set called_count=called_count+1,last_called_number=next_number,updated_at=now() where id=s.id;

  progress_result:=public.evaluate_draw_number_impact(s.id,next_number);
  select exists(select 1 from public.winner_candidates where session_id=s.id and status='detected') into has_candidate;
  if has_candidate then
    update public.draw_sessions set status='paused',paused_at=now(),updated_at=now() where id=s.id;
    update public.events set status='paused',updated_at=now() where id=s.event_id;
    perform public.log_audit(s.workspace_id,'draw.auto_paused_for_winner','draw_session',s.id::text,
      jsonb_build_object('event_id',s.event_id,'number',next_number,'sequence',next_sequence,'progress',progress_result));
  end if;

  perform public.log_audit(s.workspace_id,'draw.number_called','draw_session',s.id::text,
    jsonb_build_object('event_id',s.event_id,'number',next_number,'sequence',next_sequence,'affected_games',progress_result->'affected_games'));
  return next_number;
end; $$;
revoke all on function public.draw_next_number(uuid) from public;
grant execute on function public.draw_next_number(uuid) to authenticated;
