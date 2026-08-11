-- Corrige a homologacao Master para abrir a conferencia sem depender do workspace selecionado.
-- A leitura e a resolucao continuam restritas exclusivamente ao platform_owner.

create or replace function public.master_get_winner_candidate_conference(target_candidate_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare result jsonb;
begin
  if not public.is_platform_owner() then raise exception 'master access denied'; end if;

  select jsonb_build_object(
    'candidate_id',wc.id,
    'candidate_status',wc.status::text,
    'detected_at',wc.detected_at,
    'resolution_note',wc.resolution_note,
    'workspace_id',wc.workspace_id,
    'workspace_name',ws.name,
    'event_id',wc.event_id,
    'event_name',e.name,
    'event_status',e.status::text,
    'session_id',wc.session_id,
    'session_name',ds.name,
    'session_number',ds.session_number,
    'session_status',ds.status::text,
    'card_code',pc.code,
    'card_status',pc.status::text,
    'game_position',cg.position,
    'game_cells',coalesce(gd.cells,'[]'::jsonb),
    'called_numbers',coalesce((select jsonb_agg(dn.number order by dn.sequence_number) from public.draw_numbers dn where dn.session_id=wc.session_id and dn.status='called'),'[]'::jsonb),
    'matched_count',coalesce(gp.matched_count,0),
    'missing_count',coalesce(gp.missing_count,999),
    'is_winner',coalesce(gp.is_winner,false),
    'trigger_number',(select dn.number from public.draw_numbers dn where dn.id=wc.trigger_draw_number_id),
    'buyer_name',s.buyer_name,
    'buyer_phone',s.buyer_phone
  ) into result
  from public.winner_candidates wc
  join public.workspaces ws on ws.id=wc.workspace_id
  join public.events e on e.id=wc.event_id
  join public.draw_sessions ds on ds.id=wc.session_id
  left join public.physical_cards pc on pc.id=wc.physical_card_id
  left join public.card_games cg on cg.id=wc.card_game_id
  left join public.game_definitions gd on gd.id=wc.game_definition_id
  left join public.game_progress gp on gp.session_id=wc.session_id and gp.card_game_id=wc.card_game_id
  left join public.sales s on s.id=pc.current_sale_id
  where wc.id=target_candidate_id;

  if result is null then raise exception 'winner candidate not found'; end if;
  return result;
end;
$$;
revoke all on function public.master_get_winner_candidate_conference(uuid) from public;
grant execute on function public.master_get_winner_candidate_conference(uuid) to authenticated;

create or replace function public.master_resolve_winner_candidate(target_candidate_id uuid,target_decision text,target_note text default null)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare c public.winner_candidates%rowtype; gp public.game_progress%rowtype; winner_id uuid; clean_note text:=left(nullif(trim(target_note),''),1000);
begin
  if not public.is_platform_owner() then raise exception 'master access denied'; end if;
  if target_decision not in ('confirmed','dismissed') then raise exception 'invalid decision'; end if;
  select * into c from public.winner_candidates where id=target_candidate_id for update;
  if c.id is null then raise exception 'winner candidate not found'; end if;
  if c.status<>'detected' then raise exception 'candidate already resolved'; end if;

  if target_decision='confirmed' then
    select * into gp from public.game_progress where session_id=c.session_id and card_game_id=c.card_game_id;
    if gp.card_game_id is null or not gp.is_winner or gp.missing_count<>0 then raise exception 'this game does not currently satisfy the winning pattern'; end if;
    insert into public.winners(workspace_id,event_id,session_id,candidate_id,physical_card_id,card_game_id,game_definition_id,confirmed_by,confirmation_note)
    values(c.workspace_id,c.event_id,c.session_id,c.id,c.physical_card_id,c.card_game_id,c.game_definition_id,auth.uid(),clean_note)
    on conflict(candidate_id) do update set confirmation_note=coalesce(excluded.confirmation_note,public.winners.confirmation_note)
    returning id into winner_id;
    update public.winner_candidates set status='confirmed',resolved_at=now(),resolved_by=auth.uid(),resolution_note=coalesce(clean_note,'Bingo conferido e confirmado pelo Master durante homologação.') where id=c.id;
    perform public.log_audit(c.workspace_id,'winner.confirmed_by_master','winner_candidate',c.id::text,jsonb_build_object('event_id',c.event_id,'session_id',c.session_id,'winner_id',winner_id));
  else
    if clean_note is null then raise exception 'a reason is required'; end if;
    update public.winner_candidates set status='dismissed',resolved_at=now(),resolved_by=auth.uid(),resolution_note=clean_note where id=c.id;
    perform public.log_audit(c.workspace_id,'winner.dismissed_by_master','winner_candidate',c.id::text,jsonb_build_object('event_id',c.event_id,'session_id',c.session_id,'reason',clean_note));
  end if;
end;
$$;
revoke all on function public.master_resolve_winner_candidate(uuid,text,text) from public;
grant execute on function public.master_resolve_winner_candidate(uuid,text,text) to authenticated;

create or replace function public.master_get_draw_session_diagnostic(target_session_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare result jsonb;
begin
  if not public.is_platform_owner() then raise exception 'master access denied'; end if;
  select jsonb_build_object(
    'session_id',ds.id,
    'workspace_name',ws.name,
    'event_name',e.name,
    'event_status',e.status::text,
    'session_name',ds.name,
    'session_number',ds.session_number,
    'session_status',ds.status::text,
    'called_numbers',coalesce((select jsonb_agg(dn.number order by dn.sequence_number) from public.draw_numbers dn where dn.session_id=ds.id and dn.status='called'),'[]'::jsonb),
    'pending_candidates',coalesce((select jsonb_agg(jsonb_build_object('id',wc.id,'card_code',pc.code,'game_position',cg.position,'detected_at',wc.detected_at) order by wc.detected_at) from public.winner_candidates wc left join public.physical_cards pc on pc.id=wc.physical_card_id left join public.card_games cg on cg.id=wc.card_game_id where wc.session_id=ds.id and wc.status='detected'),'[]'::jsonb)
  ) into result
  from public.draw_sessions ds
  join public.workspaces ws on ws.id=ds.workspace_id
  join public.events e on e.id=ds.event_id
  where ds.id=target_session_id;
  if result is null then raise exception 'draw session not found'; end if;
  return result;
end;
$$;
revoke all on function public.master_get_draw_session_diagnostic(uuid) from public;
grant execute on function public.master_get_draw_session_diagnostic(uuid) to authenticated;
