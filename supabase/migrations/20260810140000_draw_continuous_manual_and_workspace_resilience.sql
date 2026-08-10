-- Sorteio continuado + chamada manual.
-- Mantém o estado no banco para que refresh, segunda tela e auditoria usem a mesma fonte de verdade.

alter table public.draw_sessions
  add column if not exists draw_method text not null default 'automatic',
  add column if not exists continues_previous boolean not null default false,
  add column if not exists continuation_source_session_id uuid references public.draw_sessions(id) on delete set null;

do $$ begin
  alter table public.draw_sessions add constraint draw_sessions_draw_method_check check (draw_method in ('automatic','manual'));
exception when duplicate_object then null; end $$;

drop function if exists public.create_draw_session(uuid,uuid,text,text);
create or replace function public.create_draw_session(
  target_event_id uuid,
  target_rule_set_id uuid default null,
  target_win_pattern_code text default null,
  target_name text default null,
  target_continue_numbers boolean default false,
  target_draw_method text default 'automatic'
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

  if target_continue_numbers then
    select * into previous_session
    from public.draw_sessions
    where event_id=e.id and status='finished'
    order by session_number desc limit 1;
    if previous_session.id is null then raise exception 'there is no finished round to continue'; end if;
    if previous_session.total_balls<>r.total_balls then raise exception 'the previous round uses a different number of balls'; end if;
  end if;

  insert into public.draw_sessions(
    workspace_id,event_id,rule_set_id,session_number,name,status,total_balls,
    win_pattern_code,win_pattern_snapshot,rule_snapshot,participant_cards,participant_games,
    draw_method,continues_previous,continuation_source_session_id
  ) values (
    e.workspace_id,e.id,r.id,next_session,
    coalesce(nullif(trim(target_name),''),'Rodada '||next_session::text),'active',r.total_balls,
    pattern->>'code',pattern,
    jsonb_build_object(
      'name',r.name,'code',r.code,'total_balls',r.total_balls,'grid_rows',r.grid_rows,'grid_columns',r.grid_columns,
      'numbers_per_game',r.numbers_per_game,'free_center',r.free_center,'distribution_mode',r.distribution_mode,
      'column_definitions',r.column_definitions,'win_patterns',r.win_patterns
    ),card_count,game_count,target_draw_method,target_continue_numbers,
    case when target_continue_numbers then previous_session.id else null end
  ) returning id into new_id;

  insert into public.draw_session_games(session_id,workspace_id,event_id,physical_card_id,card_game_id,game_definition_id,position)
    select new_id,e.workspace_id,e.id,pc.id,cg.id,cg.game_definition_id,cg.position
    from public.physical_cards pc join public.card_games cg on cg.physical_card_id=pc.id
    where pc.event_id=e.id and pc.status='sold';

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
      'carried_numbers',carried_count,'progress',progress_result));
  return new_id;
end; $$;
revoke all on function public.create_draw_session(uuid,uuid,text,text,boolean,text) from public;
grant execute on function public.create_draw_session(uuid,uuid,text,text,boolean,text) to authenticated;

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

  progress_result:=public.evaluate_draw_session_progress(s.id);
  select exists(select 1 from public.winner_candidates where session_id=s.id and status='detected') into has_candidate;
  if has_candidate then
    update public.draw_sessions set status='paused',paused_at=now(),updated_at=now() where id=s.id;
    update public.events set status='paused',updated_at=now() where id=s.event_id;
    perform public.log_audit(s.workspace_id,'draw.auto_paused_for_winner','draw_session',s.id::text,
      jsonb_build_object('event_id',s.event_id,'number',target_number,'sequence',next_sequence,'progress',progress_result,'manual',true));
  end if;

  perform public.log_audit(s.workspace_id,'draw.number_called_manual','draw_session',s.id::text,
    jsonb_build_object('event_id',s.event_id,'number',target_number,'sequence',next_sequence));
  return target_number;
end; $$;
revoke all on function public.call_manual_draw_number(uuid,integer) from public;
grant execute on function public.call_manual_draw_number(uuid,integer) to authenticated;
