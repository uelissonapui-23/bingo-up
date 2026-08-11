# Auditoria final de produção — BINGOUP

## Escopo
Revisão final orientada a produção após Fases 12–14, com atenção a Master, licenças, bloqueios, suporte, vendedor, operador, sorteio, conferência, painel público, PWA e isolamento.

## Correção aplicada nesta rodada
A Homologação agora é acionável. Possíveis ganhadores e sessões abertas exibem o evento/sessão correspondente e levam o Master para a tela operacional correta. Usuários pendentes e atendimentos mostram os registros relacionados sem conceder ao Master uma ação destrutiva automática.

## Segurança
- A RPC de diagnóstico exige `platform_owner`.
- A RPC é somente leitura e não resolve candidatos, encerra sessões ou apaga dados.
- Conferência permanece responsabilidade do fluxo de sorteio, preservando auditoria e regras existentes.
- Não foi introduzida service role no frontend.

## Integridade e isolamento
- Detalhes são derivados por `event_id`/`session_id`, evitando mistura entre eventos.
- Nenhuma política RLS existente foi relaxada.
- Nenhuma migration destrutiva foi criada.

## Homologação recomendada
1. Resolver candidatos antigos pela tela de conferência correspondente.
2. Encerrar/cancelar corretamente sessões de teste ainda abertas.
3. Reexecutar Homologação até a base automática ficar pronta.
4. Executar `lint`, `typecheck`, `test` e `build` no Windows antes do deploy.

## Risco residual conhecido
O checklist manual salvo no navegador comprova apenas que o Master marcou os testes. Ele não substitui teste real multi-dispositivo. Isso é intencional: o sistema não deve falsificar uma homologação que depende de TV, celular, vendedor e operador reais.
