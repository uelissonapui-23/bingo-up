# Fase 7 · Motor de Sorteio

## Status
Concluída estruturalmente sobre a base oficial da Fase 6.

## Entregas
- Sessões de sorteio independentes por evento, com histórico e numeração de rodada.
- Snapshot imutável das cartelas vendidas e jogos participantes no instante em que a rodada começa.
- Regra e padrão de vitória congelados na sessão para impedir alterações retroativas.
- Sorteio manual transacional via PostgreSQL/Supabase, selecionando apenas números ainda não chamados.
- Restrição de banco que impede número ativo repetido dentro da mesma sessão, inclusive sob concorrência.
- Pausa e retomada do sorteio, sincronizando o status do evento.
- Desfazer somente o último número ativo, preservando o registro original como `voided`, usuário, data e motivo.
- Finalização e cancelamento preservando histórico completo.
- Recuperação automática de sessão `active`/`paused` ao reabrir a página.
- Tela responsiva do operador com número atual, quadro completo, últimos chamados, participantes e controles grandes.
- Home de sorteio para selecionar corretamente entre vários eventos.
- RLS e RPCs com papéis `organizer_owner`, `organizer_admin` e `event_manager` já preparados.
- `public_token` da sessão criado agora para o futuro painel público sem refazer a tabela.
- Realtime habilitado para `draw_sessions` e `draw_numbers`, preparando as fases de acompanhamento e TV.
- Teste unitário das funções puras do quadro de sorteio.

## Estruturas novas
- `draw_sessions`
- `draw_session_games`
- `draw_numbers`
- `draw_session_status`
- `draw_number_status`

## RPCs
- `create_draw_session`
- `draw_next_number`
- `pause_draw_session`
- `resume_draw_session`
- `undo_last_draw_number`
- `finish_draw_session`
- `cancel_draw_session`

## Regra operacional importante
Ao iniciar uma rodada, o sistema congela os jogos pertencentes às cartelas com status `sold`. As próximas fases calculam proximidade e vencedores sobre esse snapshot. Isso evita que alterações posteriores em vendas mudem retroativamente quem participava daquela rodada.

## Validação
A árvore de imports locais, JSON e estrutura de arquivos foi auditada no ambiente de geração. A instalação npm/build completo depende do registry npm disponível na máquina de desenvolvimento. Deve-se executar `npm install` e `npm run check` antes do deploy.

## Próxima fase
Fase 8: acompanhamento automático dos jogos participantes, cálculo de distância para a premiação e detecção automática de possíveis vencedores após cada bola ou anulação.
