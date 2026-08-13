-- Corrige o fluxo completo do operador de sorteio sem transformar o operador em membro do workspace.
-- O problema anterior ocorria porque as RPCs de sorteio aceitavam o operador, mas o log_audit
-- legado exige workspace_members. O operador e intencionalmente um vinculo operacional separado.

create or replace function public.log_event_operational_audit(
  target_event_id uuid,
  target_action text,
  target_entity_type text,
  target_entity_id text default null,
  target_metadata jsonb default '{}'::jsonb
) returns bigint
language plpgsql
security definer
set search_path=public
as $$
declare
  e public.events%rowtype;
  new_id bigint;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into e from public.events where id=target_event_id;
  if e.id is null then raise exception 'event not found'; end if;
  if not public.has_workspace_role(e.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[])
     and not public.draw_operator_has_event_access(e.id)
  then
    raise exception 'access denied';
  end if;
  insert into public.audit_logs(workspace_id,actor_user_id,action,entity_type,entity_id,metadata)
  values(e.workspace_id,auth.uid(),target_action,target_entity_type,target_entity_id,coalesce(target_metadata,'{}'::jsonb))
  returning id into new_id;
  return new_id;
end;
$$;

-- Nao exponha este helper como RPC direta. Ele existe para ser chamado pelas funcoes
-- SECURITY DEFINER do sorteio depois que elas validam o evento/operador.
revoke all on function public.log_event_operational_audit(uuid,text,text,text,jsonb) from public;
revoke all on function public.log_event_operational_audit(uuid,text,text,text,jsonb) from authenticated;

-- Ao abrir uma rodada, o sistema precisa limpar reservas expiradas. O operador atribuido
-- ao evento pode executar somente essa limpeza automatica do proprio evento.
create or replace function public.expire_event_reservations(target_event_id uuid) returns integer
language plpgsql security definer set search_path=public as $$
declare e public.events%rowtype; released integer:=0; sale_row record;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into e from public.events where id=target_event_id; if e.id is null then raise exception 'event not found'; end if;
  if not public.seller_has_event_access(e.id)
     and not public.draw_operator_has_event_access(e.id)
     and not public.has_workspace_role(e.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[])
  then raise exception 'access denied'; end if;
  for sale_row in select id from public.sales where event_id=e.id and status='reserved' and reservation_expires_at is not null and reservation_expires_at<=now() for update loop
    update public.sale_items set status='canceled',canceled_at=now() where sale_id=sale_row.id and status='active';
    update public.physical_cards set status='available',current_sale_id=null,reserved_at=null,reserved_by_user_id=null,reservation_expires_at=null where current_sale_id=sale_row.id and status='reserved';
    update public.sales set status='canceled',canceled_at=now(),cancel_reason='Reserva expirada automaticamente',updated_at=now() where id=sale_row.id;
    released:=released+1;
  end loop; return released;
end; $$;
revoke all on function public.expire_event_reservations(uuid) from public;
grant execute on function public.expire_event_reservations(uuid) to authenticated;


create or replace function public.update_draw_operator_public_panel(target_event_id uuid,target_patch jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare e public.events%rowtype;current_settings jsonb;appearance jsonb;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into e from public.events where id=target_event_id;
  if e.id is null then raise exception 'event not found'; end if;
  if not public.has_workspace_role(e.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) and not public.draw_operator_has_event_access(e.id) then raise exception 'access denied'; end if;
  select settings into current_settings from public.event_settings where event_id=e.id for update;
  appearance:=target_patch->'appearance';
  update public.event_settings set
    public_panel_show_last_number=coalesce((target_patch->>'public_panel_show_last_number')::boolean,public_panel_show_last_number),
    public_panel_show_called_numbers=coalesce((target_patch->>'public_panel_show_called_numbers')::boolean,public_panel_show_called_numbers),
    public_panel_show_progress=coalesce((target_patch->>'public_panel_show_progress')::boolean,public_panel_show_progress),
    public_panel_show_near_winners=coalesce((target_patch->>'public_panel_show_near_winners')::boolean,public_panel_show_near_winners),
    settings=case when appearance is null then settings else jsonb_set(coalesce(settings,'{}'::jsonb),'{public_panel_appearance}',appearance,true) end,
    updated_at=now()
  where event_id=e.id;
  perform public.log_event_operational_audit(e.id,'public_panel.operator_updated','event',e.id::text,jsonb_build_object('patch',target_patch));
end; $$;
revoke all on function public.update_draw_operator_public_panel(uuid,jsonb) from public;
grant execute on function public.update_draw_operator_public_panel(uuid,jsonb) to authenticated;

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
  if not public.has_workspace_role(e.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) and not public.draw_operator_has_event_access(e.id) then raise exception 'access denied'; end if;
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

  perform public.log_event_operational_audit(e.id,'draw.started','draw_session',new_id::text,
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
  if not public.has_workspace_role(s.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) and not public.draw_operator_has_event_access(s.event_id) then raise exception 'access denied'; end if;
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
    perform public.log_event_operational_audit(s.event_id,'draw.auto_paused_for_winner','draw_session',s.id::text,
      jsonb_build_object('event_id',s.event_id,'number',target_number,'sequence',next_sequence,'progress',progress_result,'manual',true));
  end if;

  perform public.log_event_operational_audit(s.event_id,'draw.number_called_manual','draw_session',s.id::text,
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
  if not public.has_workspace_role(s.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) and not public.draw_operator_has_event_access(s.event_id) then raise exception 'access denied'; end if;
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
    perform public.log_event_operational_audit(s.event_id,'draw.auto_paused_for_winner','draw_session',s.id::text,
      jsonb_build_object('event_id',s.event_id,'number',next_number,'sequence',next_sequence,'progress',progress_result));
  end if;

  perform public.log_event_operational_audit(s.event_id,'draw.number_called','draw_session',s.id::text,
    jsonb_build_object('event_id',s.event_id,'number',next_number,'sequence',next_sequence,'affected_games',progress_result->'affected_games'));
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
  if not public.has_workspace_role(s.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) and not public.draw_operator_has_event_access(s.event_id) then raise exception 'access denied'; end if;
  if s.status <> 'active' then raise exception 'only an active draw can be paused'; end if;
  update public.draw_sessions set status='paused',paused_at=now(),updated_at=now() where id=s.id;
  update public.events set status='paused',updated_at=now() where id=s.event_id;
  perform public.log_event_operational_audit(s.event_id,'draw.paused','draw_session',s.id::text,jsonb_build_object('event_id',s.event_id));
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
  if not public.has_workspace_role(s.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) and not public.draw_operator_has_event_access(s.event_id) then raise exception 'access denied'; end if;
  if s.status <> 'paused' then raise exception 'only a paused draw can be resumed'; end if;
  if exists(select 1 from public.winner_candidates where session_id=s.id and status='detected') then
    raise exception 'resolve every pending winner check before resuming the draw';
  end if;
  if exists(select 1 from public.winner_candidates where session_id=s.id and status='confirmed') then
    raise exception 'this prize already has a confirmed winner; finish the round before continuing';
  end if;
  update public.draw_sessions set status='active',paused_at=null,updated_at=now() where id=s.id;
  update public.events set status='drawing',updated_at=now() where id=s.event_id;
  perform public.log_event_operational_audit(s.event_id,'draw.resumed','draw_session',s.id::text,jsonb_build_object('event_id',s.event_id));
end; $$;
revoke all on function public.resume_draw_session(uuid) from public;
grant execute on function public.resume_draw_session(uuid) to authenticated;

create or replace function public.undo_last_draw_number(target_session_id uuid,reason text default null) returns integer
language plpgsql security definer set search_path=public as $$
declare s public.draw_sessions%rowtype; dn public.draw_numbers%rowtype; previous_number integer;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into s from public.draw_sessions where id=target_session_id for update;
  if s.id is null then raise exception 'draw session not found'; end if;
  if not public.has_workspace_role(s.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) and not public.draw_operator_has_event_access(s.event_id) then raise exception 'access denied'; end if;
  if s.status not in('active','paused') then raise exception 'draw is not open'; end if;
  select * into dn from public.draw_numbers where session_id=s.id and status='called' order by sequence_number desc limit 1 for update;
  if dn.id is null then raise exception 'there is no called number to undo'; end if;
  update public.draw_numbers set status='voided',voided_by=auth.uid(),voided_at=now(),void_reason=left(nullif(trim(reason),''),500) where id=dn.id;
  select number into previous_number from public.draw_numbers where session_id=s.id and status='called' order by sequence_number desc limit 1;
  update public.draw_sessions set called_count=greatest(0,called_count-1),last_called_number=previous_number,updated_at=now() where id=s.id;
  perform public.evaluate_draw_session_progress(s.id);
  perform public.log_event_operational_audit(s.event_id,'draw.number_voided','draw_session',s.id::text,jsonb_build_object('event_id',s.event_id,'number',dn.number,'sequence',dn.sequence_number,'reason',reason));
  return dn.number;
end; $$;
revoke all on function public.undo_last_draw_number(uuid,text) from public; grant execute on function public.undo_last_draw_number(uuid,text) to authenticated;

create or replace function public.finish_draw_session(target_session_id uuid,finish_event boolean default true) returns void
language plpgsql security definer set search_path=public as $$
declare s public.draw_sessions%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into s from public.draw_sessions where id=target_session_id for update;
  if s.id is null then raise exception 'draw session not found'; end if;
  if not public.has_workspace_role(s.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) and not public.draw_operator_has_event_access(s.event_id) then raise exception 'access denied'; end if;
  if s.status not in ('active','paused') then raise exception 'draw is not open'; end if;
  if finish_event and public.draw_operator_has_event_access(s.event_id) and not public.has_workspace_role(s.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) then raise exception 'draw operator cannot finalize the whole event'; end if;
  if exists(select 1 from public.winner_candidates where session_id=s.id and status='detected') then
    raise exception 'resolve every pending winner check as winner or not winner before ending the round';
  end if;
  update public.draw_sessions set status='finished',finished_at=now(),paused_at=null,updated_at=now() where id=s.id;
  update public.events set status=case when finish_event then 'finished'::public.event_status else 'ready'::public.event_status end,updated_at=now() where id=s.event_id;
  perform public.log_event_operational_audit(s.event_id,'draw.finished','draw_session',s.id::text,
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
  if not public.has_workspace_role(s.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) and not public.draw_operator_has_event_access(s.event_id) then raise exception 'access denied'; end if;
  if s.status not in ('active','paused') then raise exception 'draw is not open'; end if;
  update public.draw_sessions set status='canceled',canceled_at=now(),paused_at=null,updated_at=now() where id=s.id;
  update public.events set status='ready',updated_at=now() where id=s.event_id;
  perform public.log_event_operational_audit(s.event_id,'draw.canceled','draw_session',s.id::text,jsonb_build_object('event_id',s.event_id,'reason',reason));
end; $$;
revoke all on function public.cancel_draw_session(uuid,text) from public;
grant execute on function public.cancel_draw_session(uuid,text) to authenticated;

create or replace function public.confirm_winner_candidate(target_candidate_id uuid,note text default null) returns uuid
language plpgsql security definer set search_path=public as $$
declare c public.winner_candidates%rowtype; gp public.game_progress%rowtype; winner_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into c from public.winner_candidates where id=target_candidate_id for update;
  if c.id is null then raise exception 'winner candidate not found'; end if;
  if not public.has_workspace_role(c.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) and not public.draw_operator_has_event_access(c.event_id) then raise exception 'access denied'; end if;
  select * into gp from public.game_progress where session_id=c.session_id and card_game_id=c.card_game_id;
  if gp.card_game_id is null or not gp.is_winner or gp.missing_count<>0 then raise exception 'this game does not currently satisfy the winning pattern'; end if;
  if c.status='dismissed' or c.status='invalidated' then raise exception 'this candidate is no longer valid'; end if;
  insert into public.winners(workspace_id,event_id,session_id,candidate_id,physical_card_id,card_game_id,game_definition_id,confirmed_by,confirmation_note)
  values(c.workspace_id,c.event_id,c.session_id,c.id,c.physical_card_id,c.card_game_id,c.game_definition_id,auth.uid(),left(nullif(trim(note),''),1000))
  on conflict(candidate_id) do update set confirmation_note=coalesce(excluded.confirmation_note,public.winners.confirmation_note)
  returning id into winner_id;
  update public.winner_candidates set status='confirmed',resolved_at=now(),resolved_by=auth.uid(),resolution_note=coalesce(left(nullif(trim(note),''),1000),'Bingo conferido e confirmado pelo operador.') where id=c.id;
  perform public.log_event_operational_audit(c.event_id,'winner.confirmed','winner_candidate',c.id::text,jsonb_build_object('event_id',c.event_id,'session_id',c.session_id,'physical_card_id',c.physical_card_id,'card_game_id',c.card_game_id));
  return winner_id;
end; $$;
revoke all on function public.confirm_winner_candidate(uuid,text) from public;
grant execute on function public.confirm_winner_candidate(uuid,text) to authenticated;

create or replace function public.dismiss_winner_candidate(target_candidate_id uuid,note text) returns void
language plpgsql security definer set search_path=public as $$
declare c public.winner_candidates%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if nullif(trim(note),'') is null then raise exception 'a reason is required'; end if;
  select * into c from public.winner_candidates where id=target_candidate_id for update;
  if c.id is null then raise exception 'winner candidate not found'; end if;
  if not public.has_workspace_role(c.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) and not public.draw_operator_has_event_access(c.event_id) then raise exception 'access denied'; end if;
  if c.status='confirmed' then raise exception 'a confirmed winner cannot be dismissed'; end if;
  update public.winner_candidates set status='dismissed',resolved_at=now(),resolved_by=auth.uid(),resolution_note=left(trim(note),1000) where id=c.id;
  perform public.log_event_operational_audit(c.event_id,'winner.dismissed','winner_candidate',c.id::text,jsonb_build_object('event_id',c.event_id,'session_id',c.session_id,'reason',left(trim(note),1000)));
end; $$;
revoke all on function public.dismiss_winner_candidate(uuid,text) from public;
grant execute on function public.dismiss_winner_candidate(uuid,text) to authenticated;
