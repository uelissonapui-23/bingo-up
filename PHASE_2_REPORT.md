# Fase 2 — Eventos

## Objetivo
Concluir o módulo de eventos sobre a base da Fase 1, mantendo o MVP rápido para um único organizador e deixando as estruturas reutilizáveis prontas para vendedores e multi-organizadores.

## Entregue
- Entidade `events` completa, vinculada obrigatoriamente a `workspace_id`.
- `event_settings` separado para preferências operacionais, vendas e painel público.
- Estados de evento preparados para rascunho, vendas, sorteio, finalização, cancelamento e arquivamento.
- Criação transacional de evento + configurações + auditoria.
- RLS por workspace e papéis já preparados para `event_manager` futuro.
- Arquivamento/restauração auditáveis.
- Bucket privado `event-assets` com políticas por workspace.
- Upload de banner JPG/PNG/WEBP até 5 MB.
- Listagem, criação, edição e detalhe do evento.
- Vários eventos simultâneos, sem variável global de "evento atual".
- Configurações de comprador e painel público já modeladas para os módulos futuros.
- Dashboard conectado aos eventos reais.
- Testes unitários do schema de eventos.
- Correção estrutural do roteamento: removido `BrowserRouter` duplicado da Fase 1.

## Preparado, mas ainda não ativado
- Vendedores e atribuição de cartelas.
- Regras/templates de bingo.
- Geração de cartelas.
- Vendas efetivas.
- Sorteio e painel público em tempo real.

Esses módulos usarão `event_id` e `workspace_id` como chaves de isolamento, evitando reconstrução posterior.

## Validação local recomendada
```bash
npm install
npm run check
```
Depois aplicar migrations do Supabase antes de testar o módulo de eventos.
