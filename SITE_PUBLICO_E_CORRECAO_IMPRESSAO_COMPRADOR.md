# Site público + impressão da cartela do comprador

## Impressão
A página autenticada do comprador agora possui uma área de impressão dedicada (`print-area`). Isso corrige a prévia em branco causada pela regra global que oculta todo elemento que não pertença a uma área imprimível.

## Apresentação comercial
Nova rota pública `/apresentacao` (alias `/conheca`), sem login, com apresentação de recursos, fluxo, planos e chamadas para cadastro/WhatsApp.

Os planos ativos e o WhatsApp vêm do Master por meio da RPC pública `get_public_marketing_data`, sem expor configurações administrativas.
