-- Fase 14: torna a homologacao acionavel e adiciona diagnostico detalhado somente leitura.
-- Nao altera dados operacionais; apenas expoe ao platform_owner onde existem pendencias.

create or replace function public.master_get_homologation_details()
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  pending_rows jsonb;
  open_rows jsonb;
  pending_access_rows jsonb;
  support_rows jsonb;
begin
  if not public.is_platform_owner() then
    raise exception 'master access denied';
  end if;

  select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x.detected_at desc),'[]'::jsonb)
    into pending_rows
  from (
    select wc.id,
           wc.event_id,
           e.name as event_name,
           wc.session_id,
           ds.session_number,
           ds.name as session_name,
           pc.code as card_code,
           dsg.position as game_position,
           wc.detected_at
    from public.winner_candidates wc
    join public.events e on e.id=wc.event_id
    join public.draw_sessions ds on ds.id=wc.session_id
    left join public.physical_cards pc on pc.id=wc.physical_card_id
    left join public.draw_session_games dsg on dsg.session_id=wc.session_id and dsg.card_game_id=wc.card_game_id
    where wc.status='detected'
    order by wc.detected_at desc
    limit 100
  ) x;

  select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x.started_at desc),'[]'::jsonb)
    into open_rows
  from (
    select ds.id as session_id,
           ds.event_id,
           e.name as event_name,
           ds.session_number,
           ds.name as session_name,
           ds.status::text,
           ds.called_count,
           ds.participant_games,
           ds.started_at
    from public.draw_sessions ds
    join public.events e on e.id=ds.event_id
    where ds.status in ('active','paused')
    order by ds.started_at desc
    limit 50
  ) x;

  select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x.created_at desc),'[]'::jsonb)
    into pending_access_rows
  from (
    select c.user_id,
           u.email::text,
           p.display_name,
           c.reason,
           u.created_at
    from public.platform_user_controls c
    join auth.users u on u.id=c.user_id
    left join public.profiles p on p.id=c.user_id
    where c.access_status='suspended' and c.reason='Aguardando liberação comercial'
    order by u.created_at desc
    limit 100
  ) x;

  select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x.last_message_at desc),'[]'::jsonb)
    into support_rows
  from (
    select t.id as thread_id,
           t.user_id,
           u.email::text,
           p.display_name,
           t.subject,
           t.last_message_at
    from public.platform_support_threads t
    join auth.users u on u.id=t.user_id
    left join public.profiles p on p.id=t.user_id
    where t.status='open'
    order by t.last_message_at desc
    limit 100
  ) x;

  return jsonb_build_object(
    'pending_winners',pending_rows,
    'open_draw_sessions',open_rows,
    'pending_access_users',pending_access_rows,
    'open_support_threads',support_rows
  );
end;
$$;

revoke all on function public.master_get_homologation_details() from public;
grant execute on function public.master_get_homologation_details() to authenticated;
