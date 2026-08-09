-- Phase 10: public TV/projector panel with a capability token and safe realtime signal.
-- No buyer, sale, card code or administrative data is exposed by this surface.
create table public.public_panel_signals (
  session_id uuid primary key references public.draw_sessions(id) on delete cascade,
  public_token uuid not null unique,
  updated_at timestamptz not null default now()
);

alter table public.public_panel_signals enable row level security;
create policy public_panel_signals_anon_select on public.public_panel_signals
  for select to anon, authenticated using (true);

create or replace function public.touch_public_panel_signal(target_session_id uuid) returns void
language plpgsql security definer set search_path=public as $$
declare s public.draw_sessions%rowtype;
begin
  select * into s from public.draw_sessions where id=target_session_id;
  if s.id is null then return; end if;
  insert into public.public_panel_signals(session_id,public_token,updated_at)
  values(s.id,s.public_token,now())
  on conflict(session_id) do update set public_token=excluded.public_token,updated_at=excluded.updated_at;
end; $$;
revoke all on function public.touch_public_panel_signal(uuid) from public;

create or replace function public.public_panel_draw_session_changed() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  perform public.touch_public_panel_signal(new.id);
  return new;
end; $$;
create trigger public_panel_draw_session_signal after insert or update on public.draw_sessions
for each row execute function public.public_panel_draw_session_changed();

create or replace function public.public_panel_winner_changed() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  perform public.touch_public_panel_signal(new.session_id);
  return new;
end; $$;
create trigger public_panel_candidate_signal after insert or update on public.winner_candidates
for each row execute function public.public_panel_winner_changed();
create trigger public_panel_winner_signal after insert or update on public.winners
for each row execute function public.public_panel_winner_changed();

-- Backfill existing sessions so a panel can be opened for a session created before this migration.
insert into public.public_panel_signals(session_id,public_token,updated_at)
select id,public_token,updated_at from public.draw_sessions
on conflict(session_id) do nothing;

-- Safe public projection. The UUID token is the capability; only public scoreboard data is returned.
create or replace function public.get_public_panel_state(target_public_token uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
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
  select * into s from public.draw_sessions where public_token=target_public_token;
  if s.id is null then raise exception 'public panel not found'; end if;
  select * into ev from public.events where id=s.event_id;
  select * into es from public.event_settings where event_id=s.event_id;

  select coalesce(array_agg(number order by sequence_number),'{}'::integer[])
    into called from public.draw_numbers where session_id=s.id and status='called';

  if coalesce(es.public_panel_show_near_winners,true) then
    select count(*) filter(where missing_count=1 and not is_winner),
           count(*) filter(where missing_count=2 and not is_winner)
      into one_away,two_away from public.game_progress where session_id=s.id;
  end if;

  select count(*) filter(where status='detected'),count(*) filter(where status='confirmed')
    into detected,confirmed from public.winner_candidates where session_id=s.id;
  pattern_name:=coalesce(s.win_pattern_snapshot->>'name',s.win_pattern_code);

  return jsonb_build_object(
    'session_id',s.id,
    'event_name',ev.name,
    'round_name',s.name,
    'status',s.status,
    'total_balls',s.total_balls,
    'called_count',s.called_count,
    'last_called_number',case when coalesce(es.public_panel_show_last_number,true) then s.last_called_number else null end,
    'called_numbers',case when coalesce(es.public_panel_show_called_numbers,true) then to_jsonb(called) else '[]'::jsonb end,
    'one_away',case when coalesce(es.public_panel_show_near_winners,true) then one_away else null end,
    'two_away',case when coalesce(es.public_panel_show_near_winners,true) then two_away else null end,
    'show_progress',coalesce(es.public_panel_show_progress,true),
    'show_near_winners',coalesce(es.public_panel_show_near_winners,true),
    'possible_bingo',detected>0,
    'confirmed_bingo',confirmed>0,
    'confirmed_winners',confirmed,
    'win_pattern_name',pattern_name,
    'updated_at',now()
  );
end; $$;
revoke all on function public.get_public_panel_state(uuid) from public;
grant execute on function public.get_public_panel_state(uuid) to anon, authenticated;

alter publication supabase_realtime add table public.public_panel_signals;
