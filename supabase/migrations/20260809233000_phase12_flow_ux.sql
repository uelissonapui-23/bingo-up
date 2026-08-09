-- Fase 12.4: fluxo operacional mais claro entre rodadas.
-- Permite reabrir explicitamente um evento encerrado por engano para continuar com uma nova rodada.

create or replace function public.reopen_event_for_next_draw(target_event_id uuid) returns void
language plpgsql security definer set search_path=public as $$
declare e public.events%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into e from public.events where id=target_event_id for update;
  if e.id is null then raise exception 'event not found'; end if;
  if not public.has_workspace_role(e.workspace_id,array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) then raise exception 'access denied'; end if;
  if e.status <> 'finished' then raise exception 'only a finished event can be reopened'; end if;
  if exists(select 1 from public.draw_sessions where event_id=e.id and status in ('active','paused')) then raise exception 'event already has an open draw session'; end if;
  update public.events set status='ready',updated_at=now() where id=e.id;
  perform public.log_audit(e.workspace_id,'draw.event_reopened','event',e.id::text,jsonb_build_object('previous_status','finished','new_status','ready'));
end; $$;
revoke all on function public.reopen_event_for_next_draw(uuid) from public;
grant execute on function public.reopen_event_for_next_draw(uuid) to authenticated;
