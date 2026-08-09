# Fase 9 — Conferência e Premiação

## Entregue
- Conferência pelo código da cartela e acesso direto a cada candidato detectado.
- Comparação com o snapshot oficial da rodada, jogo interno e progresso calculado.
- Exibição da grade numérica do jogo, comprador quando registrado e bola decisiva.
- Confirmação transacional do vencedor no banco.
- Suporte a vários vencedores na mesma rodada.
- Rejeição de conferência com motivo obrigatório e auditoria.
- Tabela `winners` como histórico definitivo e imutável da premiação.
- Candidato confirmado não é apagado por recálculos posteriores.
- RLS e RPCs protegidas por papéis administrativos já previstos.
- Realtime preparado para `winners`.

## Integridade
A interface não decide sozinha se existe bingo. `confirm_winner_candidate` revalida `game_progress` no banco no instante da confirmação. Um candidato invalidado ou rejeitado não pode ser confirmado.

## Próxima fase
Fase 10 — Painel Público para TV/projetor, consumindo somente dados públicos seguros da sessão e sem expor compradores, vendas ou controles administrativos.
