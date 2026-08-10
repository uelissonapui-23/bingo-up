-- Estabilidade da TV entre rodadas + política opcional de elegibilidade de jogos já premiados.

alter table public.draw_sessions
  add column if not exists exclude_previously_awarded_games boolean not null default false;

-- Nova assinatura: preserva sorteio continuado/manual e adiciona exclusão opcional de jogos já premiados.
drop function if exists public.create_draw_session(uuid,uuid,text,text,boolean,text);
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
  card_count integer;
  game_count integer;
  carried_count integer:=0;
  carried_last integer;
  progress_result jsonb;
  has_candidate boolean:=false;
  is_full_card boolean:=false;
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

  if target_win_pattern_code is null then
    pattern:=r.win_patterns->0;
  else
    select p.value into pattern from jsonb_array_elements(r.win_patterns) p(value) where p.value->>'code'=target_win_pattern_code limit 1;
  end if;
  if pattern is null then raise exception 'win pattern not found'; end if;
  is_full_card:=coalesce(pattern->>'kind','')='full_card' or coalesce(pattern->>'code','')='full_card';

  select coalesce(max(session_number),0)+1 into next_session from public.draw_sessions where event_id=e.id;
  select count(*) into card_count from public.physical_cards where event_id=e.id and status='sold';
  if card_count=0 then raise exception 'at least one sold card is required to start the draw'; end if;

  if target_continue_numbers then
    select * into previous_session from public.draw_sessions where event_id=e.id and status='finished' order by session_number desc limit 1;
    if previous_session.id is null then raise exception 'there is no finished round to continue'; end if;
    if previous_session.total_balls<>r.total_balls then raise exception 'the previous round uses a different number of balls'; end if;
  end if;

  insert into public.draw_sessions(
    workspace_id,event_id,rule_set_id,session_number,name,status,total_balls,
    win_pattern_code,win_pattern_snapshot,rule_snapshot,participant_cards,participant_games,
    draw_method,continues_previous,continuation_source_session_id,exclude_previously_awarded_games
  ) values (
    e.workspace_id,e.id,r.id,next_session,
    coalesce(nullif(trim(target_name),''),'Rodada '||next_session::text),'active',r.total_balls,
    pattern->>'code',pattern,
    jsonb_build_object(
      'name',r.name,'code',r.code,'total_balls',r.total_balls,'grid_rows',r.grid_rows,'grid_columns',r.grid_columns,
      'numbers_per_game',r.numbers_per_game,'free_center',r.free_center,'distribution_mode',r.distribution_mode,
      'column_definitions',r.column_definitions,'win_patterns',r.win_patterns
    ),card_count,0,target_draw_method,target_continue_numbers,
    case when target_continue_numbers then previous_session.id else null end,
    target_exclude_previously_awarded_games and not is_full_card
  ) returning id into new_id;

  insert into public.draw_session_games(session_id,workspace_id,event_id,physical_card_id,card_game_id,game_definition_id,position)
    select new_id,e.workspace_id,e.id,pc.id,cg.id,cg.game_definition_id,cg.position
    from public.physical_cards pc
    join public.card_games cg on cg.physical_card_id=pc.id
    where pc.event_id=e.id and pc.status='sold'
      and (
        not target_exclude_previously_awarded_games
        or is_full_card
        or not exists(
          select 1 from public.winners w
          where w.event_id=e.id and w.card_game_id=cg.id
        )
      );

  select count(*) into game_count from public.draw_session_games where session_id=new_id;
  if game_count=0 then
    delete from public.draw_sessions where id=new_id;
    raise exception 'no eligible games remain for this prize';
  end if;
  update public.draw_sessions set participant_games=game_count where id=new_id;

  if target_continue_numbers then
    insert into public.draw_numbers(workspace_id,event_id,session_id,number,sequence_number,status,called_by,called_at)
      select e.workspace_id,e.id,new_id,dn.number,dn.sequence_number,'called',auth.uid(),now()
      from public.draw_numbers dn
      where dn.session_id=previous_session.id and dn.status='called'
      order by dn.sequence_number;

    select count(*) into carried_count from public.draw_numbers where session_id=new_id and status='called';
    select number into carried_last from public.draw_numbers where session_id=new_id and status='called' order by sequence_number desc limit 1;
    update public.draw_sessions set called_count=carried_count,last_called_number=carried_last,updated_at=now() where id=new_id;

    progress_result:=public.evaluate_draw_session_progress(new_id);
    select exists(select 1 from public.winner_candidates where session_id=new_id and status='detected') into has_candidate;
    if has_candidate then
      update public.draw_sessions set status='paused',paused_at=now(),updated_at=now() where id=new_id;
      update public.events set status='paused',updated_at=now() where id=e.id;
    else
      update public.events set status='drawing',updated_at=now() where id=e.id;
    end if;
  else
    update public.events set status='drawing',updated_at=now() where id=e.id;
  end if;

  perform public.log_audit(e.workspace_id,'draw.started','draw_session',new_id::text,
    jsonb_build_object('event_id',e.id,'session_number',next_session,'participant_cards',card_count,'participant_games',game_count,
      'win_pattern',pattern->>'code','draw_method',target_draw_method,'continues_previous',target_continue_numbers,
      'exclude_previously_awarded_games',target_exclude_previously_awarded_games and not is_full_card,
      'carried_numbers',carried_count,'progress',progress_result));
  return new_id;
end; $$;
revoke all on function public.create_draw_session(uuid,uuid,text,text,boolean,text,boolean) from public;
grant execute on function public.create_draw_session(uuid,uuid,text,text,boolean,text,boolean) to authenticated;

-- A TV sempre resolve o token original para o evento e então escolhe a rodada atual mais nova.
-- Vencedor confirmado vem da tabela imutável winners, evitando ficar preso em um candidato antigo.
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

  select * into s
  from public.draw_sessions
  where event_id=seed.event_id
  order by case when status in ('active','paused') then 0 else 1 end, session_number desc
  limit 1;
  if s.id is null then raise exception 'draw session not found'; end if;

  select * into ev from public.events where id=s.event_id;
  select * into es from public.event_settings where event_id=s.event_id;
  select coalesce(array_agg(number order by sequence_number),'{}'::integer[])
    into called from public.draw_numbers where session_id=s.id and status='called';

  if coalesce(es.public_panel_show_near_winners,true) then
    select count(*) filter(where missing_count=1 and not is_winner),count(*) filter(where missing_count=2 and not is_winner)
      into one_away,two_away from public.game_progress where session_id=s.id;
  end if;
  select count(*) into detected from public.winner_candidates where session_id=s.id and status='detected';
  select count(*) into confirmed from public.winners where session_id=s.id;
  pattern_name:=coalesce(s.win_pattern_snapshot->>'name',s.win_pattern_code);

  return jsonb_build_object(
    'session_id',s.id,'session_number',s.session_number,'public_token',target_public_token,
    'event_name',ev.name,'round_name',s.name,'status',s.status,
    'total_balls',s.total_balls,'called_count',s.called_count,
    'last_called_number',case when coalesce(es.public_panel_show_last_number,true) then s.last_called_number else null end,
    'called_numbers',case when coalesce(es.public_panel_show_called_numbers,true) then to_jsonb(called) else '[]'::jsonb end,
    'one_away',case when coalesce(es.public_panel_show_near_winners,true) then one_away else null end,
    'two_away',case when coalesce(es.public_panel_show_near_winners,true) then two_away else null end,
    'show_progress',coalesce(es.public_panel_show_progress,true),'show_near_winners',coalesce(es.public_panel_show_near_winners,true),
    'possible_bingo',detected>0 and confirmed=0,'confirmed_bingo',confirmed>0,'confirmed_winners',confirmed,
    'win_pattern_name',pattern_name,'updated_at',now()
  );
end; $$;
revoke all on function public.get_public_panel_state(uuid) from public;
grant execute on function public.get_public_panel_state(uuid) to anon,authenticated;
