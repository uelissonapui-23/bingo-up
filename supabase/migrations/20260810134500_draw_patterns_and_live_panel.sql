-- BINGOUP: padrões de premiação ampliados e painel público contínuo entre rodadas.

-- Acrescenta padrões operacionais sem remover padrões personalizados existentes.
with presets as (
  select '[
    {"code":"any_five","name":"Qualquer quina","kind":"any_line"},
    {"code":"row_1","name":"Quina específica: 1ª linha","kind":"specific_row","target_index":0},
    {"code":"row_2","name":"Quina específica: 2ª linha","kind":"specific_row","target_index":1},
    {"code":"row_3","name":"Quina específica: 3ª linha","kind":"specific_row","target_index":2},
    {"code":"row_4","name":"Quina específica: 4ª linha","kind":"specific_row","target_index":3},
    {"code":"row_5","name":"Quina específica: 5ª linha","kind":"specific_row","target_index":4},
    {"code":"any_column","name":"Qualquer letra/coluna","kind":"any_column"},
    {"code":"column_b","name":"Letra específica: B","kind":"specific_column","target_index":0},
    {"code":"column_i","name":"Letra específica: I","kind":"specific_column","target_index":1},
    {"code":"column_n","name":"Letra específica: N","kind":"specific_column","target_index":2},
    {"code":"column_g","name":"Letra específica: G","kind":"specific_column","target_index":3},
    {"code":"column_o","name":"Letra específica: O","kind":"specific_column","target_index":4},
    {"code":"any_diagonal","name":"Qualquer diagonal","kind":"any_diagonal"},
    {"code":"diagonal_main","name":"Diagonal principal","kind":"diagonal_main"},
    {"code":"diagonal_secondary","name":"Diagonal secundária","kind":"diagonal_secondary"},
    {"code":"four_corners","name":"Quatro cantos","kind":"four_corners"}
  ]'::jsonb as items
)
update public.bingo_rule_sets r
set win_patterns = r.win_patterns || coalesce((
  select jsonb_agg(p.value)
  from presets, jsonb_array_elements(presets.items) p(value)
  where not exists (
    select 1 from jsonb_array_elements(r.win_patterns) current(value)
    where current.value->>'code'=p.value->>'code'
  )
),'[]'::jsonb),
updated_at=now()
where r.grid_rows=5 and r.grid_columns=5;


-- Garante os mesmos padrões em novas regras 5x5 criadas depois desta migration.
create or replace function public.add_standard_5x5_win_patterns() returns trigger
language plpgsql set search_path=public as $$
declare
  presets jsonb:='[
    {"code":"any_five","name":"Qualquer quina","kind":"any_line"},
    {"code":"row_1","name":"Quina específica: 1ª linha","kind":"specific_row","target_index":0},
    {"code":"row_2","name":"Quina específica: 2ª linha","kind":"specific_row","target_index":1},
    {"code":"row_3","name":"Quina específica: 3ª linha","kind":"specific_row","target_index":2},
    {"code":"row_4","name":"Quina específica: 4ª linha","kind":"specific_row","target_index":3},
    {"code":"row_5","name":"Quina específica: 5ª linha","kind":"specific_row","target_index":4},
    {"code":"any_column","name":"Qualquer letra/coluna","kind":"any_column"},
    {"code":"column_b","name":"Letra específica: B","kind":"specific_column","target_index":0},
    {"code":"column_i","name":"Letra específica: I","kind":"specific_column","target_index":1},
    {"code":"column_n","name":"Letra específica: N","kind":"specific_column","target_index":2},
    {"code":"column_g","name":"Letra específica: G","kind":"specific_column","target_index":3},
    {"code":"column_o","name":"Letra específica: O","kind":"specific_column","target_index":4},
    {"code":"any_diagonal","name":"Qualquer diagonal","kind":"any_diagonal"},
    {"code":"diagonal_main","name":"Diagonal principal","kind":"diagonal_main"},
    {"code":"diagonal_secondary","name":"Diagonal secundária","kind":"diagonal_secondary"},
    {"code":"four_corners","name":"Quatro cantos","kind":"four_corners"},
    {"code":"full_card","name":"Cartela cheia","kind":"full_card"}
  ]'::jsonb;
  missing jsonb;
begin
  if new.grid_rows=5 and new.grid_columns=5 then
    select coalesce(jsonb_agg(p.value),'[]'::jsonb) into missing
    from jsonb_array_elements(presets) p(value)
    where not exists(select 1 from jsonb_array_elements(coalesce(new.win_patterns,'[]'::jsonb)) current(value) where current.value->>'code'=p.value->>'code');
    new.win_patterns:=coalesce(new.win_patterns,'[]'::jsonb)||missing;
  end if;
  return new;
end; $$;
drop trigger if exists bingo_rule_sets_standard_patterns on public.bingo_rule_sets;
create trigger bingo_rule_sets_standard_patterns
before insert or update of win_patterns,grid_rows,grid_columns on public.bingo_rule_sets
for each row execute function public.add_standard_5x5_win_patterns();

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

-- O link público de uma rodada passa a acompanhar automaticamente a rodada atual do mesmo evento.
create or replace function public.get_public_panel_state(target_public_token uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  seed public.draw_sessions%rowtype;
  s public.draw_sessions%rowtype;
  ev public.events%rowtype;
  es public.event_settings%rowtype;
  called integer[];
  one_away integer:=0;
  two_away integer:=0;
  detected integer:=0;
  confirmed integer:=0;
  pattern_name text;
begin
  select * into seed from public.draw_sessions where public_token=target_public_token;
  if seed.id is null then raise exception 'public panel not found'; end if;

  select * into s from public.draw_sessions
  where event_id=seed.event_id and status in ('active','paused')
  order by session_number desc limit 1;
  if s.id is null then
    select * into s from public.draw_sessions where event_id=seed.event_id order by session_number desc limit 1;
  end if;

  select * into ev from public.events where id=s.event_id;
  select * into es from public.event_settings where event_id=s.event_id;
  select coalesce(array_agg(number order by sequence_number),'{}'::integer[])
    into called from public.draw_numbers where session_id=s.id and status='called';

  if coalesce(es.public_panel_show_near_winners,true) then
    select count(*) filter(where missing_count=1 and not is_winner),count(*) filter(where missing_count=2 and not is_winner)
      into one_away,two_away from public.game_progress where session_id=s.id;
  end if;
  select count(*) filter(where status='detected'),count(*) filter(where status='confirmed')
    into detected,confirmed from public.winner_candidates where session_id=s.id;
  pattern_name:=coalesce(s.win_pattern_snapshot->>'name',s.win_pattern_code);

  return jsonb_build_object(
    'session_id',s.id,'public_token',s.public_token,'event_name',ev.name,'round_name',s.name,'status',s.status,
    'total_balls',s.total_balls,'called_count',s.called_count,
    'last_called_number',case when coalesce(es.public_panel_show_last_number,true) then s.last_called_number else null end,
    'called_numbers',case when coalesce(es.public_panel_show_called_numbers,true) then to_jsonb(called) else '[]'::jsonb end,
    'one_away',case when coalesce(es.public_panel_show_near_winners,true) then one_away else null end,
    'two_away',case when coalesce(es.public_panel_show_near_winners,true) then two_away else null end,
    'show_progress',coalesce(es.public_panel_show_progress,true),'show_near_winners',coalesce(es.public_panel_show_near_winners,true),
    'possible_bingo',detected>0,'confirmed_bingo',confirmed>0,'confirmed_winners',confirmed,
    'win_pattern_name',pattern_name,'updated_at',now()
  );
end; $$;
revoke all on function public.get_public_panel_state(uuid) from public;
grant execute on function public.get_public_panel_state(uuid) to anon, authenticated;
