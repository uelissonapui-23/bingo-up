# Fase 11 — Dashboard, Histórico e Relatórios

## Objetivo
Consolidar os dados reais já produzidos pelos módulos anteriores em um painel útil para o organizador, sem criar métricas fictícias nem misturar eventos.

## Implementado
- Dashboard refeito usando agregações reais do Supabase.
- Indicadores de eventos ativos, cartelas emitidas/vendidas, total vendido, sessões e vencedores.
- Área geral `/historico` com visão consolidada do workspace.
- Relatório por evento em `/eventos/:eventId/historico`.
- Resumo de cartelas por status.
- Resumo de vendas, total e ticket médio.
- Histórico de sessões de sorteio, participantes, bolas chamadas e vencedores.
- Vendas agrupadas por dia.
- Exportação CSV UTF-8 compatível com Excel/LibreOffice.
- RPCs `get_workspace_dashboard` e `get_event_report` com verificação de membership e isolamento por workspace.
- Navegação desktop e mobile atualizada com Histórico.

## Decisões
- Não foram adicionados gráficos decorativos. O relatório prioriza números e tabelas operacionais.
- Agregações principais foram colocadas em RPCs para reduzir round-trips e manter o isolamento no banco.
- A estrutura é compatível com vendedores futuros porque `sales.seller_user_id` já existe; relatórios por vendedor entram quando o módulo for ativado.

## Validação
- Imports locais auditados.
- JSON de configuração validado.
- A validação npm completa depende de `npm install` no ambiente local, pois o registry deste ambiente tem retornado 404 para `@eslint/js`.
