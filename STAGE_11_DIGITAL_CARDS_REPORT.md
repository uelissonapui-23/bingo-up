# Etapa 11 — Cartelas digitais por link

A rota pública `/c/:token`, que antes era apenas um placeholder, agora entrega a cartela digital real somente quando a cartela física está com venda concluída (`status = sold`). O token impresso continua sendo o mesmo UUID aleatório já existente.

A RPC pública usa `security definer` e retorna somente dados necessários para a cartela: evento, código/série, jogos, regra e estado do sorteio. Dados do comprador, valores, vendas, workspace e usuários não são expostos.

A cartela acompanha o sorteio em polling leve, marca automaticamente pedras já chamadas e preserva os últimos dados em falhas momentâneas de rede. A conferência oficial permanece no painel do organizador/operador.
