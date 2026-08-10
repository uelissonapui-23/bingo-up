# Painel público

Tela pública para TV, segundo monitor ou projetor. Usa um `public_token` UUID por sessão e uma RPC `security definer` que devolve apenas dados seguros para o público.

O painel é otimizado para 16:9 e telas grandes, sem depender do shell autenticado. Exibe número atual, últimos chamados, quadro BINGO completo, andamento da rodada e proximidade de premiação. Possui ação de tela cheia e estados próprios para possível bingo e vencedor confirmado.

O Realtime observa somente `public_panel_signals`, uma tabela sem dados administrativos. Ao receber o sinal, o cliente busca novamente a projeção pública segura. Existe polling de 12 s apenas como fallback para redes que bloqueiem websocket.
