-- Fase 11: dashboard, histórico e relatórios operacionais.
-- Agregações ficam no banco para reduzir múltiplas consultas, preservar isolamento e permitir evolução futura.

create or replace function public.get_workspace_dashboard(target_workspace_id uuid)
returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not public.is_workspace_member(target_workspace_id) then raise exception 'access denied'; end if;

  select jsonb_build_object(
    'events_total', (select count(*) from public.events e where e.workspace_id=target_workspace_id and e.status<>'archived'),
    'events_active', (select count(*) from public.events e where e.workspace_id=target_workspace_id and e.status in ('sales_open','sales_paused','ready','drawing','paused')),
    'cards_issued', (select count(*) from public.physical_cards c where c.workspace_id=target_workspace_id and c.status<>'void'),
    'cards_sold', (select count(*) from public.physical_cards c where c.workspace_id=target_workspace_id and c.status='sold'),
    'sales_completed', (select count(*) from public.sales s where s.workspace_id=target_workspace_id and s.status='completed'),
    'sales_amount', coalesce((select sum(s.total_amount) from public.sales s where s.workspace_id=target_workspace_id and s.status='completed'),0),
    'draw_sessions', (select count(*) from public.draw_sessions d where d.workspace_id=target_workspace_id),
    'winners', (select count(*) from public.winners w where w.workspace_id=target_workspace_id),
    'recent_events', coalesce((select jsonb_agg(row_to_json(x)::jsonb order by x.created_at desc) from (
      select e.id,e.name,e.status,e.starts_at,e.created_at,
        (select count(*) from public.physical_cards c where c.event_id=e.id and c.status<>'void') as cards_issued,
        (select count(*) from public.physical_cards c where c.event_id=e.id and c.status='sold') as cards_sold,
        coalesce((select sum(s.total_amount) from public.sales s where s.event_id=e.id and s.status='completed'),0) as sales_amount,
        (select count(*) from public.winners w where w.event_id=e.id) as winners
      from public.events e where e.workspace_id=target_workspace_id and e.status<>'archived'
      order by coalesce(e.starts_at,e.created_at) desc limit 6
    ) x),'[]'::jsonb)
  ) into result;
  return result;
end; $$;
revoke all on function public.get_workspace_dashboard(uuid) from public;
grant execute on function public.get_workspace_dashboard(uuid) to authenticated;

create or replace function public.get_event_report(target_event_id uuid)
returns jsonb
language plpgsql security definer set search_path=public as $$
declare e public.events%rowtype; result jsonb;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into e from public.events where id=target_event_id;
  if e.id is null then raise exception 'event not found'; end if;
  if not public.is_workspace_member(e.workspace_id) then raise exception 'access denied'; end if;

  select jsonb_build_object(
    'event', jsonb_build_object('id',e.id,'name',e.name,'status',e.status,'starts_at',e.starts_at,'ends_at',e.ends_at),
    'cards', jsonb_build_object(
      'issued',(select count(*) from public.physical_cards c where c.event_id=e.id and c.status<>'void'),
      'available',(select count(*) from public.physical_cards c where c.event_id=e.id and c.status='available'),
      'reserved',(select count(*) from public.physical_cards c where c.event_id=e.id and c.status='reserved'),
      'sold',(select count(*) from public.physical_cards c where c.event_id=e.id and c.status='sold'),
      'canceled',(select count(*) from public.physical_cards c where c.event_id=e.id and c.status in ('canceled','void'))
    ),
    'sales', jsonb_build_object(
      'completed',(select count(*) from public.sales s where s.event_id=e.id and s.status='completed'),
      'reserved',(select count(*) from public.sales s where s.event_id=e.id and s.status='reserved'),
      'canceled',(select count(*) from public.sales s where s.event_id=e.id and s.status='canceled'),
      'amount',coalesce((select sum(s.total_amount) from public.sales s where s.event_id=e.id and s.status='completed'),0),
      'average_ticket',coalesce((select avg(s.total_amount) from public.sales s where s.event_id=e.id and s.status='completed'),0)
    ),
    'draws', jsonb_build_object(
      'total',(select count(*) from public.draw_sessions d where d.event_id=e.id),
      'finished',(select count(*) from public.draw_sessions d where d.event_id=e.id and d.status='finished'),
      'called_numbers',coalesce((select sum(d.called_count) from public.draw_sessions d where d.event_id=e.id),0)
    ),
    'winners',(select count(*) from public.winners w where w.event_id=e.id),
    'sessions',coalesce((select jsonb_agg(row_to_json(x)::jsonb order by x.session_number desc) from (
      select d.id,d.session_number,d.name,d.status,d.win_pattern_code,d.participant_cards,d.participant_games,d.called_count,d.started_at,d.finished_at,
        (select count(*) from public.winners w where w.session_id=d.id) as winners
      from public.draw_sessions d where d.event_id=e.id order by d.session_number desc
    ) x),'[]'::jsonb),
    'sales_by_day',coalesce((select jsonb_agg(row_to_json(x)::jsonb order by x.day) from (
      select (s.completed_at at time zone 'UTC')::date as day,count(*) as sales_count,sum(s.total_amount) as amount
      from public.sales s where s.event_id=e.id and s.status='completed' and s.completed_at is not null
      group by 1 order by 1
    ) x),'[]'::jsonb)
  ) into result;
  return result;
end; $$;
revoke all on function public.get_event_report(uuid) from public;
grant execute on function public.get_event_report(uuid) to authenticated;
