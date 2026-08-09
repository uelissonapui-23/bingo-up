# Painel público — Fase 10

Tela pública para TV, segundo monitor ou projetor. Usa um `public_token` UUID por sessão e uma RPC `security definer` que devolve apenas dados seguros para o público.

Exibe: último número, quadro de números chamados, progresso da rodada, quantidades de jogos a 1 e 2 números da premiação, possível bingo e bingo confirmado.

Não expõe: comprador, telefone/e-mail, valores, vendas, códigos das cartelas próximas, IDs de jogos, controles administrativos ou credenciais.

O Realtime observa somente `public_panel_signals`, uma tabela sem dados administrativos. Ao receber o sinal, o cliente busca novamente a projeção pública segura. Existe polling de 15 s apenas como fallback para redes que bloqueiem websocket.
