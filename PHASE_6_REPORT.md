# Fase 6 — Vendas básicas do organizador

## Objetivo
Colocar o fluxo de venda de cartelas em funcionamento para o primeiro organizador sem criar uma estrutura provisória que precise ser refeita quando entrarem vendedores.

## Implementado
- Área global `/vendas` e área específica `/eventos/:eventId/vendas`.
- Seleção de evento e isolamento por `workspace_id` + `event_id`.
- Venda individual ou em lote, inclusive seleção por faixa de sequência e pesquisa por código.
- Campos do comprador respeitando as exigências configuradas no evento.
- Preço padrão do evento com possibilidade de ajuste por operação.
- Reserva temporária quando habilitada no evento.
- Expiração e liberação automática de reservas ao carregar/operar o evento.
- Conversão de reserva em venda.
- Cancelamento auditado, preservando o histórico e liberando cartelas somente antes do sorteio.
- Resumo de disponíveis, reservadas, vendidas, vendas concluídas e valor vendido.
- Histórico com cartelas vinculadas, comprador, total, status e expiração.
- Teste unitário para validação de comprador e normalização monetária.

## Banco definitivo reaproveitável
Foram criadas `sales` e `sale_items`. A venda já possui `seller_user_id` e `channel`, apesar de o módulo de vendedores ainda não estar liberado. Isso evita remodelar vendas depois.

`physical_cards` recebeu os campos operacionais de venda/reserva (`sold_at`, `sold_by_user_id`, `current_sale_id`, `reserved_at`, `reserved_by_user_id`, `reservation_expires_at`). Os números e a composição da cartela continuam imutáveis.

## Concorrência e integridade
As escritas não são feitas diretamente pelo frontend. As RPCs transacionais bloqueiam as cartelas com `FOR UPDATE`, verificam o status dentro da transação e só então reservam ou vendem. Um índice parcial impede dois itens ativos para a mesma cartela.

RPCs:
- `create_card_sale`
- `complete_reserved_sale`
- `cancel_sale`
- `expire_event_reservations`

## Segurança
Nesta fase somente `organizer_owner`, `organizer_admin` e `event_manager` podem alterar vendas. A leitura já foi desenhada para que um futuro vendedor veja somente vendas cujo `seller_user_id` seja o próprio usuário. A autorização por evento será ativada no módulo de vendedores.

## Regra de cancelamento
Venda concluída não pode ser cancelada depois que o sorteio estiver em `drawing`, `paused` ou `finished`. Reservas podem expirar automaticamente. Cancelamentos preservam `sales` e `sale_items` como histórico, em vez de apagar registros.

## Validação pendente no ambiente local
A estrutura e os imports internos foram auditados. A validação completa com `npm run check` deve ser executada no computador do projeto caso o registry deste ambiente continue sem fornecer `@eslint/js`.

## Próxima fase
Fase 7: motor de sorteio, sessão, sorteio manual sem repetição, pausa/continuação, desfazer auditado, recuperação de sessão e base para Realtime/painel público.
