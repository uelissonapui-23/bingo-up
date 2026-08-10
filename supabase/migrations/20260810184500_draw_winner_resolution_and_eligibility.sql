-- Segurança de premiação e elegibilidade de jogos.
-- Regras:
-- 1) somente cartelas vendidas entram no snapshot da rodada;
-- 2) em sorteio continuado, jogos já premiados ficam automaticamente fora;
-- 3) ao reiniciar as bolas, jogos premiados voltam a ser elegíveis por padrão,
--    salvo quando o organizador marcar a exclusão;
-- 4) nenhuma rodada pode ser retomada ou encerrada enquanto houver candidato
--    aguardando decisão do operador.

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
  has_candidate boolean:=false;
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

  if target_win_pattern_code is null then
    pattern:=r.win_patterns->0;
  else
    select p.value into pattern from jsonb_array_elements(r.win_patterns) p(value) where p.value->>'code'=target_win_pattern_code limit 1;
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

  -- Em uma sequência continuada, o jogo que já ganhou não pode vencer novamente
  -- usando a mesma sequência acumulada. Ao zerar as bolas isso volta a ser opcional.
  effective_exclusion:=target_continue_numbers or target_exclude_previously_awarded_games;

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
    ),0,0,target_draw_method,target_continue_numbers,
    case when target_continue_numbers then previous_session.id else null end,
    effective_exclusion
  ) returning id into new_id;

  insert into public.draw_session_games(session_id,workspace_id,event_id,physical_card_id,card_game_id,game_definition_id,position)
    select new_id,e.workspace_id,e.id,pc.id,cg.id,cg.game_definition_id,cg.position
    from public.physical_cards pc
    join public.card_games cg on cg.physical_card_id=pc.id
    where pc.event_id=e.id
      and pc.workspace_id=e.workspace_id
      and pc.status='sold'
      and (
        not effective_exclusion
        or not exists(
          select 1 from public.winners w
          where w.event_id=e.id and w.card_game_id=cg.id
        )
      );

  select count(distinct physical_card_id),count(*)
    into card_count,game_count
  from public.draw_session_games where session_id=new_id;

  if game_count=0 then
    delete from public.draw_sessions where id=new_id;
    raise exception 'no eligible sold games remain for this prize';
  end if;

  update public.draw_sessions
  set participant_cards=card_count,participant_games=game_count
  where id=new_id;

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
    jsonb_build_object('event_id',e.id,'session_number',next_session,'sold_cards',sold_card_count,
      'participant_cards',card_count,'participant_games',game_count,
      'win_pattern',pattern->>'code','draw_method',target_draw_method,'continues_previous',target_continue_numbers,
      'exclude_previously_awarded_games',effective_exclusion,'carried_numbers',carried_count,'progress',progress_result));
  return new_id;
end; $$;
revoke all on function public.create_draw_session(uuid,uuid,text,text,boolean,text,boolean) from public;
grant execute on function public.create_draw_session(uuid,uuid,text,text,boolean,text,boolean) to authenticated;

create or replace function public.resume_draw_session(target_session_id uuid) returns void
language plpgsql security definer set search_path=public as $$
declare s public.draw_sessions%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into s from public.draw_sessions where id=target_session_id for update;
  if s.id is null then raise exception 'draw session not found'; end if;
  if not public.has_workspace_role(s.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) then raise exception 'access denied'; end if;
  if s.status <> 'paused' then raise exception 'only a paused draw can be resumed'; end if;
  if exists(select 1 from public.winner_candidates where session_id=s.id and status='detected') then
    raise exception 'resolve every pending winner check before resuming the draw';
  end if;
  if exists(select 1 from public.winner_candidates where session_id=s.id and status='confirmed') then
    raise exception 'this prize already has a confirmed winner; finish the round before continuing';
  end if;
  update public.draw_sessions set status='active',paused_at=null,updated_at=now() where id=s.id;
  update public.events set status='drawing',updated_at=now() where id=s.event_id;
  perform public.log_audit(s.workspace_id,'draw.resumed','draw_session',s.id::text,jsonb_build_object('event_id',s.event_id));
end; $$;
revoke all on function public.resume_draw_session(uuid) from public;
grant execute on function public.resume_draw_session(uuid) to authenticated;

create or replace function public.finish_draw_session(target_session_id uuid,finish_event boolean default true) returns void
language plpgsql security definer set search_path=public as $$
declare s public.draw_sessions%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into s from public.draw_sessions where id=target_session_id for update;
  if s.id is null then raise exception 'draw session not found'; end if;
  if not public.has_workspace_role(s.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) then raise exception 'access denied'; end if;
  if s.status not in ('active','paused') then raise exception 'draw is not open'; end if;
  if exists(select 1 from public.winner_candidates where session_id=s.id and status='detected') then
    raise exception 'resolve every pending winner check as winner or not winner before ending the round';
  end if;
  update public.draw_sessions set status='finished',finished_at=now(),paused_at=null,updated_at=now() where id=s.id;
  update public.events set status=case when finish_event then 'finished'::public.event_status else 'ready'::public.event_status end,updated_at=now() where id=s.event_id;
  perform public.log_audit(s.workspace_id,'draw.finished','draw_session',s.id::text,
    jsonb_build_object('event_id',s.event_id,'called_count',s.called_count,'finish_event',finish_event));
end; $$;
revoke all on function public.finish_draw_session(uuid,boolean) from public;
grant execute on function public.finish_draw_session(uuid,boolean) to authenticated;

-- Defesa adicional: mesmo que algum cliente antigo tente chamar uma bola durante
-- uma conferência pendente, o banco impede a nova pedra.
create or replace function public.block_called_number_with_pending_winner() returns trigger
language plpgsql set search_path=public as $$
begin
  if new.status='called' and exists(
    select 1 from public.winner_candidates wc
    where wc.session_id=new.session_id and wc.status='detected'
  ) then
    raise exception 'resolve every pending winner check before calling another number';
  end if;
  return new;
end; $$;

drop trigger if exists draw_numbers_block_pending_winner on public.draw_numbers;
create trigger draw_numbers_block_pending_winner
before insert on public.draw_numbers
for each row execute function public.block_called_number_with_pending_winner();
