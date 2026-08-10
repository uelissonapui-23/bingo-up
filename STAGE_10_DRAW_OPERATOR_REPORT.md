# BINGOUP — Operador de sorteio

## Objetivo
Criar um login operacional separado do vendedor, por convite e por evento, sem conceder permissões administrativas do organizador.

## Acesso permitido
- visualizar somente eventos explicitamente atribuídos;
- iniciar e continuar rodadas de sorteio;
- selecionar regra ativa e premiação/padrão da rodada;
- chamada automática ou manual;
- pausar, retomar, desfazer número e cancelar rodada;
- conferir possíveis vencedores e marcar vencedor/não ganhador;
- encerrar somente a rodada e preparar a próxima;
- abrir e configurar aparência/elementos da tela pública do evento autorizado.

## Acesso bloqueado
- criar/editar/excluir evento;
- finalizar o evento inteiro;
- criar/editar/imprimir cartelas;
- vender ou cancelar vendas;
- gerenciar vendedores, operadores, workspace ou assinatura;
- alterar a definição estrutural das regras de bingo.

## Segurança
O papel `draw_operator` é separado de `event_manager` e `seller`. O vínculo operacional fica em `event_draw_operator_assignments`, por evento. As RPCs de sorteio foram preservadas e apenas passaram a aceitar um operador quando `draw_operator_has_event_access(event_id)` confirmar o vínculo ativo. A edição do painel público usa uma RPC dedicada que aceita somente campos visuais/visibilidade.

A navegação do frontend também redireciona o operador para a área de sorteio caso ele tente abrir uma rota administrativa, mas a proteção principal continua no Supabase/RLS/RPC.
