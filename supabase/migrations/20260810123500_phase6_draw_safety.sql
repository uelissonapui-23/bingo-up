-- Etapa 6: sorteio seguro. Ao detectar possível vencedor, pausa a rodada
-- atomicamente para impedir que o operador avance números antes da conferência.
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

  select n into next_number
  from generate_series(1,s.total_balls)n
  where not exists(
    select 1 from public.draw_numbers dn
    where dn.session_id=s.id and dn.number=n and dn.status='called'
  )
  order by random()
  limit 1;
  if next_number is null then raise exception 'no available number'; end if;

  select coalesce(max(sequence_number),0)+1 into next_sequence
  from public.draw_numbers where session_id=s.id;

  insert into public.draw_numbers(workspace_id,event_id,session_id,number,sequence_number,status)
  values(s.workspace_id,s.event_id,s.id,next_number,next_sequence,'called');

  update public.draw_sessions
  set called_count=called_count+1,last_called_number=next_number,updated_at=now()
  where id=s.id;

  progress_result:=public.evaluate_draw_session_progress(s.id);
  select exists(
    select 1 from public.winner_candidates
    where session_id=s.id and status='detected'
  ) into has_candidate;

  if has_candidate then
    update public.draw_sessions set status='paused',paused_at=now(),updated_at=now() where id=s.id;
    update public.events set status='paused',updated_at=now() where id=s.event_id;
    perform public.log_audit(s.workspace_id,'draw.auto_paused_for_winner','draw_session',s.id::text,
      jsonb_build_object('event_id',s.event_id,'number',next_number,'sequence',next_sequence,'progress',progress_result));
  end if;

  perform public.log_audit(s.workspace_id,'draw.number_called','draw_session',s.id::text,
    jsonb_build_object('event_id',s.event_id,'number',next_number,'sequence',next_sequence));
  return next_number;
end; $$;
revoke all on function public.draw_next_number(uuid) from public;
grant execute on function public.draw_next_number(uuid) to authenticated;
