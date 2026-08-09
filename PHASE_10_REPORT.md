# Fase 10 — Painel Público para TV/Projetor

## Entregue
- Rota pública `/painel-publico/:publicSessionId`, sem login administrativo.
- Token público UUID por sessão reutilizando a estrutura criada na Fase 7.
- RPC pública segura `get_public_panel_state`, sem exposição de vendas, compradores ou códigos das cartelas.
- Último número em destaque.
- Quadro completo dos números já sorteados.
- Contador de sorteados/restantes.
- Quantidade de jogos faltando 1 e 2 números, respeitando as configurações do evento.
- Estado especial de possível bingo, sem identificar a cartela ao público.
- Estado de bingo confirmado e suporte a múltiplos vencedores confirmados.
- Realtime através da tabela pública mínima `public_panel_signals`.
- Fallback de atualização a cada 15 segundos caso websocket seja bloqueado.
- Botão no painel do operador para abrir a tela pública em nova janela/TV.
- Layout responsivo e específico para telas públicas, sem menus e controles administrativos.

## Segurança
O painel não consulta diretamente `draw_sessions`, `game_progress`, `winner_candidates`, `winners`, `sales` ou `physical_cards` como usuário anônimo. A leitura pública passa por uma projeção controlada no banco e retorna somente informações apropriadas ao público.

## Migration
`20260809143000_phase10_public_panel.sql`

## Validação
Foi feita auditoria estrutural de imports e arquivos JSON. O `npm install`/`npm run check` depende do registry npm disponível no ambiente de execução local.
