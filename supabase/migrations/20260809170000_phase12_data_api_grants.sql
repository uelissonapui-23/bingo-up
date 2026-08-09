-- Fase 12: privilégios explícitos da Data API.
-- O projeto foi criado com "Automatically expose new tables" desativado.
-- Portanto, concedemos somente os privilégios necessários aos papéis da API
-- e continuamos usando RLS como barreira de acesso por linha.

grant usage on schema public to authenticated, anon;

-- O app administrativo autenticado consulta e, quando permitido pelas políticas RLS,
-- grava nas tabelas públicas abaixo. Sem estes GRANTs o PostgREST retorna erro de permissão
-- mesmo quando as políticas RLS estão corretas.
grant select, insert, update, delete on table
  public.profiles,
  public.platform_members,
  public.workspaces,
  public.workspace_members,
  public.audit_logs,
  public.plans,
  public.workspace_settings,
  public.subscriptions,
  public.usage_counters,
  public.user_preferences,
  public.events,
  public.event_settings,
  public.bingo_rule_sets,
  public.card_templates,
  public.card_batches,
  public.game_definitions,
  public.physical_cards,
  public.card_games,
  public.card_print_jobs,
  public.sales,
  public.sale_items,
  public.draw_sessions,
  public.draw_session_games,
  public.draw_numbers,
  public.game_progress,
  public.winner_candidates,
  public.winners,
  public.public_panel_signals
  to authenticated;

-- Necessário para inserts em tabelas que usam identity/sequence quando a operação
-- não é encapsulada por uma função SECURITY DEFINER.
grant usage, select on all sequences in schema public to authenticated;

-- O painel público usa apenas este sinal mínimo para Realtime.
-- A política RLS da tabela continua controlando a leitura e nenhum dado administrativo
-- é exposto por esse canal.
grant select on table public.public_panel_signals to anon;

-- As funções públicas necessárias já possuem GRANT EXECUTE nas migrations que as criaram.
-- Recarrega o cache do PostgREST após a mudança de privilégios.
notify pgrst, 'reload schema';
