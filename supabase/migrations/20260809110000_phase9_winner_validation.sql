-- Phase 9: winner validation, confirmation and immutable award history.
create table public.winners (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  session_id uuid not null references public.draw_sessions(id) on delete cascade,
  candidate_id uuid not null unique references public.winner_candidates(id) on delete restrict,
  physical_card_id uuid not null references public.physical_cards(id) on delete restrict,
  card_game_id uuid not null references public.card_games(id) on delete restrict,
  game_definition_id uuid not null references public.game_definitions(id) on delete restrict,
  confirmed_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz not null default now(),
  confirmation_note text,
  created_at timestamptz not null default now()
);
create index winners_session_idx on public.winners(session_id,confirmed_at);
create index winners_event_idx on public.winners(event_id,confirmed_at desc);
alter table public.winners enable row level security;
create policy winners_member_select on public.winners for select to authenticated using(public.is_workspace_member(workspace_id));

create or replace function public.confirm_winner_candidate(target_candidate_id uuid,note text default null) returns uuid
language plpgsql security definer set search_path=public as $$
declare c public.winner_candidates%rowtype; gp public.game_progress%rowtype; winner_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into c from public.winner_candidates where id=target_candidate_id for update;
  if c.id is null then raise exception 'winner candidate not found'; end if;
  if not public.has_workspace_role(c.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) then raise exception 'access denied'; end if;
  select * into gp from public.game_progress where session_id=c.session_id and card_game_id=c.card_game_id;
  if gp.card_game_id is null or not gp.is_winner or gp.missing_count<>0 then raise exception 'this game does not currently satisfy the winning pattern'; end if;
  if c.status='dismissed' or c.status='invalidated' then raise exception 'this candidate is no longer valid'; end if;
  insert into public.winners(workspace_id,event_id,session_id,candidate_id,physical_card_id,card_game_id,game_definition_id,confirmed_by,confirmation_note)
  values(c.workspace_id,c.event_id,c.session_id,c.id,c.physical_card_id,c.card_game_id,c.game_definition_id,auth.uid(),left(nullif(trim(note),''),1000))
  on conflict(candidate_id) do update set confirmation_note=coalesce(excluded.confirmation_note,public.winners.confirmation_note)
  returning id into winner_id;
  update public.winner_candidates set status='confirmed',resolved_at=now(),resolved_by=auth.uid(),resolution_note=coalesce(left(nullif(trim(note),''),1000),'Bingo conferido e confirmado pelo operador.') where id=c.id;
  perform public.log_audit(c.workspace_id,'winner.confirmed','winner_candidate',c.id::text,jsonb_build_object('event_id',c.event_id,'session_id',c.session_id,'physical_card_id',c.physical_card_id,'card_game_id',c.card_game_id));
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
  if not public.has_workspace_role(c.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) then raise exception 'access denied'; end if;
  if c.status='confirmed' then raise exception 'a confirmed winner cannot be dismissed'; end if;
  update public.winner_candidates set status='dismissed',resolved_at=now(),resolved_by=auth.uid(),resolution_note=left(trim(note),1000) where id=c.id;
  perform public.log_audit(c.workspace_id,'winner.dismissed','winner_candidate',c.id::text,jsonb_build_object('event_id',c.event_id,'session_id',c.session_id,'reason',left(trim(note),1000)));
end; $$;
revoke all on function public.dismiss_winner_candidate(uuid,text) from public;
grant execute on function public.dismiss_winner_candidate(uuid,text) to authenticated;

alter publication supabase_realtime add table public.winners;
