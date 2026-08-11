-- Fase 14 - Homologacao para venda.
-- Diagnostico somente leitura para o platform_owner. Nao altera dados operacionais.

create or replace function public.master_get_homologation_status()
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  master_count bigint;
  workspace_count bigint;
  workspaces_without_license bigint;
  pending_access bigint;
  blocked_users bigint;
  open_support bigint;
  pending_winners bigint;
  open_draws bigint;
  event_count bigint;
  sold_cards bigint;
  overall text;
begin
  if not public.is_platform_owner() then
    raise exception 'master access denied';
  end if;

  select count(*) into master_count
  from public.platform_members
  where role='platform_owner';

  select count(*) into workspace_count from public.workspaces;

  select count(*) into workspaces_without_license
  from public.workspaces w
  left join public.workspace_licenses l on l.workspace_id=w.id
  where l.workspace_id is null;

  select count(*) into pending_access
  from public.platform_user_controls
  where access_status='suspended'
    and reason='Aguardando liberação comercial';

  select count(*) into blocked_users
  from public.platform_user_controls
  where access_status='suspended'
    and coalesce(reason,'')<>'Aguardando liberação comercial';

  select count(*) into open_support
  from public.platform_support_threads
  where status='open';

  select count(*) into pending_winners
  from public.winner_candidates
  where status='detected';

  select count(*) into open_draws
  from public.draw_sessions
  where status in ('open','paused');

  select count(*) into event_count from public.events;
  select count(*) into sold_cards from public.physical_cards where status='sold';

  overall := case
    when master_count=0 or workspaces_without_license>0 then 'critical'
    when pending_winners>0 then 'attention'
    else 'ready'
  end;

  return jsonb_build_object(
    'status',overall,
    'checked_at',now(),
    'metrics',jsonb_build_object(
      'masters',master_count,
      'workspaces',workspace_count,
      'events',event_count,
      'sold_cards',sold_cards,
      'pending_access_users',pending_access,
      'blocked_users',blocked_users,
      'open_support_threads',open_support,
      'pending_winner_candidates',pending_winners,
      'open_draw_sessions',open_draws,
      'workspaces_without_license',workspaces_without_license
    ),
    'checks',jsonb_build_array(
      jsonb_build_object('id','master','level',case when master_count>0 then 'ok' else 'critical' end,'title','Conta Master','detail',case when master_count>0 then master_count||' conta(s) Master configurada(s).' else 'Nenhuma conta platform_owner configurada.' end),
      jsonb_build_object('id','licenses','level',case when workspaces_without_license=0 then 'ok' else 'critical' end,'title','Licenças dos organizadores','detail',case when workspaces_without_license=0 then 'Todos os organizadores possuem registro de licença.' else workspaces_without_license||' organizador(es) sem licença vinculada.' end),
      jsonb_build_object('id','winner_resolution','level',case when pending_winners=0 then 'ok' else 'warning' end,'title','Conferências pendentes','detail',case when pending_winners=0 then 'Nenhum possível ganhador aguardando decisão.' else pending_winners||' possível(is) ganhador(es) aguardando conferência.' end),
      jsonb_build_object('id','support','level','info','title','Atendimentos abertos','detail',open_support||' atendimento(s) aberto(s) no suporte.'),
      jsonb_build_object('id','pending_access','level','info','title','Novos usuários aguardando liberação','detail',pending_access||' usuário(s) aguardando liberação comercial.'),
      jsonb_build_object('id','draws','level','info','title','Sessões de sorteio abertas','detail',open_draws||' sessão(ões) aberta(s) ou pausada(s).')
    )
  );
end;
$$;

revoke all on function public.master_get_homologation_status() from public;
grant execute on function public.master_get_homologation_status() to authenticated;
