# Fase 3 concluída — Regras e Templates de Cartelas

## Entrega

A Fase 3 implementa a configuração matemática do bingo e os layouts físicos reutilizados pelo gerador da Fase 4.

### Regras do bingo
- tabela `bingo_rule_sets` isolada por `workspace_id` e `event_id`;
- preset 75 bolas, grade 5×5 com casa livre;
- suporte a regra personalizada;
- distribuição livre ou faixas por coluna;
- padrões de vitória armazenados na regra;
- uma regra padrão por evento;
- ativação/desativação;
- validação de payload no PostgreSQL;
- RLS e auditoria;
- `locked_at` preparado para impedir alterações matemáticas após geração de lotes na Fase 4.

### Capacidade e unicidade
- cálculo exato com `BigInt`;
- capacidade de jogos únicos;
- limite de cartelas físicas 1 em 1, 2 em 1 e 3 em 1 sem reutilizar nenhum jogo interno;
- cálculo separado de composições físicas únicas, evitando confundir composição com reutilização de jogo;
- testes unitários para combinatória e bingo 75 bolas.

### Templates
- tabela `card_templates` com isolamento e RLS;
- formatos de 1 a 6 jogos preparados no banco;
- interface inicial para 1 em 1, 2 em 1 e 3 em 1;
- presets: clássico, compacto, banner grande, vertical, horizontal, três lado a lado, três empilhados e 1+2;
- orientação, tamanho A4/Letter preparado, posição e altura do banner;
- flags já previstas para nome do evento, data, código, série e QR Code;
- um template padrão por formato e evento;
- preview responsivo antes da geração.

### Integração
- rota `/eventos/:eventId/cartelas/configuracao`;
- acesso a partir da tela do evento;
- defaults criados de forma idempotente por RPC;
- estrutura pronta para o motor de geração da Fase 4.

## Próxima fase

Fase 4: motor de geração em lote, assinaturas, unicidade global, limite prévio, repetição controlada, progresso, cancelamento seguro e persistência das cartelas físicas/jogos internos.
