-- Permite que o operador atribuído finalize todos os sorteios do evento e informa
-- explicitamente à tela pública quando o evento foi encerrado de forma definitiva.

create or replace function public.finish_draw_session(target_session_id uuid,finish_event boolean default true) returns void
language plpgsql security definer set search_path=public as $$
declare s public.draw_sessions%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into s from public.draw_sessions where id=target_session_id for update;
  if s.id is null then raise exception 'draw session not found'; end if;
  if not public.has_workspace_role(s.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[])
     and not public.draw_operator_has_event_access(s.event_id)
  then raise exception 'access denied'; end if;
  if s.status not in ('active','paused') then raise exception 'draw is not open'; end if;
  if exists(select 1 from public.winner_candidates where session_id=s.id and status='detected') then
    raise exception 'resolve every pending winner check as winner or not winner before ending the round';
  end if;

  update public.draw_sessions
     set status='finished',finished_at=now(),paused_at=null,updated_at=now()
   where id=s.id;
  update public.events
     set status=case when finish_event then 'finished'::public.event_status else 'ready'::public.event_status end,
         updated_at=now()
   where id=s.event_id;

  perform public.log_event_operational_audit(
    s.event_id,
    case when finish_event then 'draw.event_finished' else 'draw.finished' end,
    'draw_session',
    s.id::text,
    jsonb_build_object('event_id',s.event_id,'called_count',s.called_count,'finish_event',finish_event)
  );
end; $$;
revoke all on function public.finish_draw_session(uuid,boolean) from public;
grant execute on function public.finish_draw_session(uuid,boolean) to authenticated;

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
  winner_labels jsonb:='[]'::jsonb;
  pattern_name text;
  appearance jsonb;
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
  select coalesce(jsonb_agg(pc.code||' · Jogo '||cg.position order by pc.code,cg.position),'[]'::jsonb) into winner_labels
  from public.winners w
  join public.physical_cards pc on pc.id=w.physical_card_id
  join public.card_games cg on cg.id=w.card_game_id
  where w.session_id=s.id;

  pattern_name:=coalesce(s.win_pattern_snapshot->>'name',s.win_pattern_code);
  appearance:=coalesce(es.settings->'public_panel_appearance',jsonb_build_object(
    'theme','classic','board_style','blocks','ball_animation','zoom','victory_animation','confetti','animation_intensity','normal',
    'show_round_name',true,'show_prize',true,'show_recent_numbers',true,'show_counters',true,'animated_frame',false
  ));

  return jsonb_build_object(
    'session_id',s.id,'session_number',s.session_number,'public_token',target_public_token,
    'event_name',ev.name,'event_status',ev.status,'event_finished',ev.status='finished',
    'round_name',s.name,'status',s.status,
    'total_balls',s.total_balls,'called_count',s.called_count,
    'last_called_number',case when coalesce(es.public_panel_show_last_number,true) then s.last_called_number else null end,
    'called_numbers',case when coalesce(es.public_panel_show_called_numbers,true) then to_jsonb(called) else '[]'::jsonb end,
    'one_away',case when coalesce(es.public_panel_show_near_winners,true) then one_away else null end,
    'two_away',case when coalesce(es.public_panel_show_near_winners,true) then two_away else null end,
    'show_progress',coalesce(es.public_panel_show_progress,true),
    'show_near_winners',coalesce(es.public_panel_show_near_winners,true),
    'possible_bingo',detected>0 and confirmed=0,
    'confirmed_bingo',confirmed>0,
    'confirmed_winners',confirmed,
    'winner_labels',winner_labels,
    'win_pattern_name',pattern_name,
    'appearance',appearance,
    'updated_at',now()
  );
end; $$;
revoke all on function public.get_public_panel_state(uuid) from public;
grant execute on function public.get_public_panel_state(uuid) to anon,authenticated;
