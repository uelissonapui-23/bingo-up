# Fase 4 concluída · Motor de geração de cartelas

## Objetivo
Implementar o núcleo que transforma regras e templates em lotes persistentes de cartelas, preservando a regra de não repetição e permitindo repetição controlada somente quando solicitada e matematicamente necessária.

## Entregue
- `card_batches`: lote, série, formato, política de unicidade, progresso, contadores e snapshot de capacidade.
- `game_definitions`: catálogo canônico de jogos, único por regra e assinatura.
- `physical_cards`: cartela física com código, sequência, formato, composição e token público preparado para QR/cartela digital.
- `card_games`: vínculo de cada posição da cartela física ao jogo canônico.
- RLS de leitura por workspace e gravações críticas somente por RPCs autorizadas.
- RPC transacional para criação do lote, persistência em chunks, finalização, falha e cancelamento/limpeza.
- Revalidação no banco de quantidade de números, faixa permitida, duplicidade interna, assinatura, células e distribuição por colunas.
- Bloqueio de composição física duplicada para formatos com mais de um jogo.
- Motor TypeScript para geração aleatória criptograficamente alimentada no navegador.
- Planejamento de capacidade considerando jogos únicos já emitidos, não apenas a capacidade matemática total.
- Modo estrito sem reutilização.
- Modo controlado com no máximo um jogo reaproveitado por cartela 2 em 1 ou 3 em 1.
- Para 1 em 1, repetição somente depois que o conjunto inédito disponível deixa de atender a quantidade solicitada.
- Tela `/eventos/:eventId/cartelas/gerar` com regra, formato, template, série, quantidade, numeração, capacidade, política de unicidade, progresso e histórico de lotes.
- Geração e persistência em chunks de 100 cartelas para reduzir tamanho das requisições.
- Cancelamento de lote parcial com limpeza das cartelas e dos jogos canônicos que ficaram órfãos.
- Testes unitários do plano de geração, unicidade e repetição controlada.
- Correção estrutural do cliente Supabase: os módulos anteriores importavam `supabase`, mas o cliente só exportava `getSupabaseClient`. Foi adicionado um proxy lazy tipado, evitando erro de build e mantendo mensagem explícita quando as variáveis de ambiente não estiverem configuradas.
- `StatusBadge` ganhou o estado `danger`, reutilizável por falhas operacionais dos próximos módulos.

## Decisões para evitar retrabalho
A modelagem separa `game_definitions` de ocorrências em `card_games`. Isso permite que sorteio, proximidade, vendas, impressão, QR Code e cartelas digitais usem o mesmo jogo canônico sem duplicar números no banco. `physical_cards` já possui `public_token` e `assigned_to_user_id`, campos baratos agora e úteis nas fases de QR e vendedores.

## Segurança e integridade
O frontend não é a autoridade final. A RPC `persist_generated_cards` recalcula assinaturas, verifica as regras e aplica a política do lote antes de gravar. As constraints do PostgreSQL impedem códigos duplicados, posições repetidas e composições completas duplicadas em formatos múltiplos.

## Limitação operacional consciente
Para gerar jogos inéditos o cliente carrega as assinaturas já emitidas da regra. Isso é adequado ao primeiro uso e a lotes operacionais normais. A modelagem já permite migrar a geração para uma Edge Function/job assíncrono no futuro, sem alterar as tabelas de cartelas, caso a plataforma passe a gerar volumes muito grandes simultaneamente.

## Validação
A estrutura e imports internos foram revisados. `npm install` não pôde ser executado neste ambiente porque o registry interno retornou HTTP 404 para `@eslint/js`, portanto `npm run check` não foi marcado como aprovado sem execução real. A validação local continua obrigatória antes do deploy.

## Próxima fase
Fase 5: Cartelas e impressão. Deve reutilizar diretamente `card_batches`, `physical_cards`, `card_games`, `game_definitions`, templates e banner do evento para lista, busca, prévia real, PDF, impressão, QR e exportação.
