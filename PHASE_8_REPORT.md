# Fase 8 — Acompanhamento automático

## Entregue
- `game_progress`: estado calculado de cada jogo congelado na rodada.
- `winner_candidates`: possíveis vencedores detectados automaticamente, já preparado para confirmação/rejeição na Fase 9.
- Reavaliação transacional após cada bola sorteada e após desfazer uma bola.
- Contadores de jogos a 1 e 2 números do padrão.
- Detecção simultânea de múltiplos possíveis vencedores.
- Invalidação automática de candidato quando um desfazer faz o jogo deixar de completar o padrão.
- Suporte aos padrões atuais: 1 linha, 2 linhas e cartela cheia.
- Padrões personalizados sem geometria própria usam cartela cheia de forma conservadora até terem avaliador específico.
- Operador visualiza contadores e candidatos sem expor esses dados administrativos ao público.
- Realtime preparado para `game_progress` e `winner_candidates`.
- Teste unitário do resumo de progresso.

## Decisões de integridade
O cálculo usa apenas `draw_session_games`, o snapshot congelado no início da rodada. Vendas posteriores não entram retroativamente.

A fonte de verdade do acompanhamento é o banco. O frontend apenas apresenta o resultado.

## Validação
A instalação de dependências não pôde ser concluída neste ambiente porque o registry interno retorna 404 para `@eslint/js`. Por isso `npm run check` não foi declarado como aprovado. A estrutura e os imports locais foram auditados.

## Próxima fase
Fase 9 — Conferência e premiação: localizar cartela, comparar com candidatos, validar o jogo apresentado, confirmar/rejeitar prêmio, múltiplos vencedores e histórico definitivo.
