-- Encerramento e exclusão segura de eventos.
-- Um evento só pode ser excluído permanentemente depois de finalizado.

create or replace function public.finalize_event(target_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_workspace uuid;
  current_status public.event_status;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;

  select workspace_id, status
    into target_workspace, current_status
  from public.events
  where id = target_event_id;

  if target_workspace is null then raise exception 'event not found'; end if;
  if not public.has_workspace_role(target_workspace, array['organizer_owner','organizer_admin','event_manager']::public.workspace_role[]) then
    raise exception 'event finalize denied';
  end if;
  if current_status = 'archived' then raise exception 'restore archived event before finalizing'; end if;
  if current_status = 'finished' then return; end if;
  if exists (
    select 1 from public.draw_sessions
    where event_id = target_event_id and status in ('active','paused')
  ) then
    raise exception 'finish active draw session before finalizing event';
  end if;

  update public.events
  set status = 'finished',
      ends_at = coalesce(ends_at, now()),
      archived_at = null,
      updated_at = now()
  where id = target_event_id;

  perform public.log_audit(
    target_workspace,
    'event.finished',
    'event',
    target_event_id::text,
    jsonb_build_object('source', 'event_management')
  );
end;
$$;

revoke all on function public.finalize_event(uuid) from public;
grant execute on function public.finalize_event(uuid) to authenticated;

create or replace function public.delete_finished_event(target_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_workspace uuid;
  target_name text;
  current_status public.event_status;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;

  select workspace_id, name, status
    into target_workspace, target_name, current_status
  from public.events
  where id = target_event_id;

  if target_workspace is null then raise exception 'event not found'; end if;
  if not public.has_workspace_role(target_workspace, array['organizer_owner','organizer_admin']::public.workspace_role[]) then
    raise exception 'event delete denied';
  end if;
  if current_status <> 'finished' then
    raise exception 'event must be finished before permanent deletion';
  end if;
  if exists (
    select 1 from public.draw_sessions
    where event_id = target_event_id and status in ('active','paused')
  ) then
    raise exception 'event has active draw session';
  end if;

  delete from public.events where id = target_event_id;

  perform public.log_audit(
    target_workspace,
    'event.deleted',
    'event',
    target_event_id::text,
    jsonb_build_object('name', target_name, 'permanent', true)
  );
end;
$$;

revoke all on function public.delete_finished_event(uuid) from public;
grant execute on function public.delete_finished_event(uuid) to authenticated;

-- Mesmo uma exclusão direta pela API só é permitida depois do encerramento.
drop policy if exists events_admin_delete on public.events;
create policy events_admin_delete on public.events
for delete to authenticated
using (
  status = 'finished'::public.event_status
  and public.has_workspace_role(workspace_id, array['organizer_owner','organizer_admin']::public.workspace_role[])
);
