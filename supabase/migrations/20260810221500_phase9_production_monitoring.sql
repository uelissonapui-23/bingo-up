-- Etapa 9: monitoramento operacional para uso em evento real com organizador único.
-- A leitura é consolidada no banco para evitar múltiplas consultas e preservar isolamento.

create or replace function public.get_event_operational_health(target_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  e public.events%rowtype;
  settings_ok boolean;
  active_rules integer;
  active_templates integer;
  completed_batches integer;
  cards_issued integer;
  cards_sold integer;
  open_draws integer;
  pending_candidates integer;
  winners_count integer;
  mismatches integer:=0;
  last_activity timestamptz;
  checks jsonb:='[]'::jsonb;
  overall text:='ready';
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into e from public.events where id=target_event_id;
  if e.id is null then raise exception 'event not found'; end if;
  if not public.is_workspace_member(e.workspace_id) then raise exception 'access denied'; end if;

  select exists(select 1 from public.event_settings s where s.event_id=e.id and s.workspace_id=e.workspace_id) into settings_ok;
  select count(*) into active_rules from public.bingo_rule_sets r where r.event_id=e.id and r.workspace_id=e.workspace_id and r.is_active=true;
  select count(*) into active_templates from public.card_templates t where t.event_id=e.id and t.workspace_id=e.workspace_id and t.is_active=true;
  select count(*) into completed_batches from public.card_batches b where b.event_id=e.id and b.workspace_id=e.workspace_id and b.status='completed';
  select count(*) into cards_issued from public.physical_cards c where c.event_id=e.id and c.workspace_id=e.workspace_id and c.status not in ('canceled','void');
  select count(*) into cards_sold from public.physical_cards c where c.event_id=e.id and c.workspace_id=e.workspace_id and c.status='sold';
  select count(*) into open_draws from public.draw_sessions d where d.event_id=e.id and d.workspace_id=e.workspace_id and d.status in ('active','paused');
  select count(*) into pending_candidates from public.winner_candidates w where w.event_id=e.id and w.workspace_id=e.workspace_id and w.status='detected';
  select count(*) into winners_count from public.winners w where w.event_id=e.id and w.workspace_id=e.workspace_id;

  select
    (select count(*) from public.event_settings x where x.event_id=e.id and x.workspace_id<>e.workspace_id)+
    (select count(*) from public.bingo_rule_sets x where x.event_id=e.id and x.workspace_id<>e.workspace_id)+
    (select count(*) from public.card_templates x where x.event_id=e.id and x.workspace_id<>e.workspace_id)+
    (select count(*) from public.card_batches x where x.event_id=e.id and x.workspace_id<>e.workspace_id)+
    (select count(*) from public.physical_cards x where x.event_id=e.id and x.workspace_id<>e.workspace_id)+
    (select count(*) from public.sales x where x.event_id=e.id and x.workspace_id<>e.workspace_id)+
    (select count(*) from public.draw_sessions x where x.event_id=e.id and x.workspace_id<>e.workspace_id)+
    (select count(*) from public.winner_candidates x where x.event_id=e.id and x.workspace_id<>e.workspace_id)+
    (select count(*) from public.winners x where x.event_id=e.id and x.workspace_id<>e.workspace_id)
  into mismatches;

  select max(a.created_at) into last_activity
  from public.audit_logs a
  where a.workspace_id=e.workspace_id
    and (a.entity_id=e.id::text or a.metadata->>'event_id'=e.id::text);

  if mismatches>0 then
    overall:='critical';
    checks:=checks||jsonb_build_array(jsonb_build_object('code','isolation','level','critical','label','Isolamento do evento','detail',mismatches||' registro(s) com workspace divergente. Não opere até revisar.'));
  else
    checks:=checks||jsonb_build_array(jsonb_build_object('code','isolation','level','ok','label','Isolamento do evento','detail','Nenhuma divergência de workspace encontrada nos módulos críticos.'));
  end if;

  if not settings_ok then
    overall:='critical';
    checks:=checks||jsonb_build_array(jsonb_build_object('code','settings','level','critical','label','Configuração do evento','detail','event_settings ausente ou inconsistente.'));
  else
    checks:=checks||jsonb_build_array(jsonb_build_object('code','settings','level','ok','label','Configuração do evento','detail','Configuração principal disponível.'));
  end if;

  if active_rules=0 then
    if overall<>'critical' then overall:='attention'; end if;
    checks:=checks||jsonb_build_array(jsonb_build_object('code','rules','level','warning','label','Regra de bingo','detail','Nenhuma regra ativa. O sorteio não poderá iniciar.'));
  else
    checks:=checks||jsonb_build_array(jsonb_build_object('code','rules','level','ok','label','Regra de bingo','detail',active_rules||' regra(s) ativa(s).'));
  end if;

  if active_templates=0 then
    if overall<>'critical' then overall:='attention'; end if;
    checks:=checks||jsonb_build_array(jsonb_build_object('code','templates','level','warning','label','Modelos de cartela','detail','Nenhum modelo ativo disponível.'));
  else
    checks:=checks||jsonb_build_array(jsonb_build_object('code','templates','level','ok','label','Modelos de cartela','detail',active_templates||' modelo(s) ativo(s).'));
  end if;

  if cards_issued=0 then
    if overall<>'critical' then overall:='attention'; end if;
    checks:=checks||jsonb_build_array(jsonb_build_object('code','cards','level','warning','label','Cartelas geradas','detail','Ainda não há cartelas emitidas para o evento.'));
  else
    checks:=checks||jsonb_build_array(jsonb_build_object('code','cards','level','ok','label','Cartelas geradas','detail',cards_issued||' cartela(s) emitida(s) em '||completed_batches||' lote(s) concluído(s).'));
  end if;

  if cards_sold=0 then
    if overall<>'critical' then overall:='attention'; end if;
    checks:=checks||jsonb_build_array(jsonb_build_object('code','sales','level','warning','label','Participantes do sorteio','detail','Nenhuma cartela vendida. Somente cartelas vendidas entram no sorteio.'));
  else
    checks:=checks||jsonb_build_array(jsonb_build_object('code','sales','level','ok','label','Participantes do sorteio','detail',cards_sold||' cartela(s) vendida(s) e elegível(is).'));
  end if;

  if open_draws>1 then
    overall:='critical';
    checks:=checks||jsonb_build_array(jsonb_build_object('code','draw','level','critical','label','Sessões de sorteio','detail','Há mais de uma sessão aberta para o mesmo evento.'));
  elsif open_draws=1 then
    checks:=checks||jsonb_build_array(jsonb_build_object('code','draw','level','ok','label','Sessão de sorteio','detail','Há uma rodada ativa ou pausada, conforme esperado.'));
  else
    checks:=checks||jsonb_build_array(jsonb_build_object('code','draw','level','ok','label','Sessão de sorteio','detail','Nenhuma rodada aberta neste momento.'));
  end if;

  if pending_candidates>0 then
    if overall<>'critical' then overall:='attention'; end if;
    checks:=checks||jsonb_build_array(jsonb_build_object('code','conference','level','warning','label','Conferência pendente','detail',pending_candidates||' possível(is) vencedor(es) aguardando decisão. O sorteio deve permanecer bloqueado.'));
  else
    checks:=checks||jsonb_build_array(jsonb_build_object('code','conference','level','ok','label','Conferência','detail','Nenhum possível vencedor pendente.'));
  end if;

  return jsonb_build_object(
    'overall',overall,'server_time',now(),'event_id',e.id,'event_status',e.status,
    'settings_ok',settings_ok,'isolation_ok',mismatches=0,'workspace_mismatches',mismatches,
    'active_rules',active_rules,'active_templates',active_templates,'completed_batches',completed_batches,
    'cards_issued',cards_issued,'cards_sold',cards_sold,'open_draws',open_draws,
    'pending_candidates',pending_candidates,'winners',winners_count,'last_activity_at',last_activity,'checks',checks
  );
end;
$$;
revoke all on function public.get_event_operational_health(uuid) from public;
grant execute on function public.get_event_operational_health(uuid) to authenticated;
