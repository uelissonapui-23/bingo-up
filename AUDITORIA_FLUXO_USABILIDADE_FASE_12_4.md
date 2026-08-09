# BINGOUP — Auditoria de fluxo e usabilidade

Base analisada: BINGO(3).zip

## Problemas encontrados e corrigidos

### 1. Arte de fundo e coringa estavam escondidos
O sistema só mostrava os controles de arte/coringa dentro de "Novo layout".
Isso fazia parecer que um modelo já existente não podia ser personalizado.

Correção:
- cada modelo agora tem um botão principal "Personalizar arte e coringa";
- o editor abre preenchido com a personalização atual;
- é possível trocar a imagem de fundo sem criar outro layout;
- é possível remover ou manter a arte atual;
- zoom horizontal, vertical e escala permanecem disponíveis;
- o coringa pode ser estrela, bola, coração, símbolo, fogueira, futebol, nenhum ou imagem personalizada;
- imagem personalizada existente é mantida até o usuário trocar;
- o gabarito PNG aparece diretamente em cada modelo;
- o gerador abre diretamente o modelo selecionado usando `?editar=<id>`.

### 2. Fluxo entre as páginas não era natural
Foi criado um componente reutilizável "Fluxo do evento" com:
1. Configurar cartela
2. Gerar cartelas
3. Imprimir / PDF
4. Registrar vendas
5. Fazer sorteio
6. Histórico

Ele aparece nas telas operacionais do evento para o usuário não precisar adivinhar onde ir depois.

### 3. Sorteio não avançava naturalmente para a próxima rodada
O botão antigo "Finalizar sorteio" encerrava também o evento.
Depois disso o banco corretamente recusava uma nova sessão, mas para o usuário parecia que o sistema travava.

Correção:
- novo botão principal "Encerrar rodada e preparar a próxima";
- ele encerra somente a rodada e mantém o evento pronto;
- após confirmação de vencedor aparece um destaque "Pronto para a próxima rodada";
- ao encerrar uma rodada, o sistema tenta pré-selecionar o próximo padrão de premiação;
- "Finalizar todo o evento" ficou separado e explícito;
- eventos já finalizados por engano podem ser reabertos pela própria tela de sorteio;
- nova RPC auditável `reopen_event_for_next_draw` registra essa reabertura.

### 4. Status do evento podia ser colocado em estados inconsistentes manualmente
Antes era possível marcar manualmente "sorteando", "pausado" ou "finalizado" sem uma sessão correspondente.

Correção:
- estados críticos de sorteio passam a ser controlados pelo motor de sorteio;
- seleção manual fica limitada aos estados operacionais seguros;
- a tela explica como continuar um evento finalizado.

### 5. Risco de travamento na geração
A base enviada ainda permitia solicitar 1.000.000 de cartelas em um único lote no navegador.

Correção:
- limite operacional de 10.000 cartelas por lote;
- para mais unidades, o usuário cria lotes adicionais;
- isso preserva a lógica de unicidade sem colocar celular/computador em risco.

### 6. Banner do evento confundia com arte da cartela
Correção:
- "Banner do evento" foi separado conceitualmente da "Arte da cartela";
- botão direto "Configurar arte das cartelas" foi adicionado.

## Validação executada
- TypeScript / typecheck: PASSOU
- ESLint: PASSOU
- Vitest/build: não executados neste ambiente porque o `node_modules` do ZIP foi instalado no Windows e o ambiente de validação é Linux; o binding nativo Linux do Rolldown não está presente.

## Depois de extrair
1. `npm run check`
2. `npx supabase db push`
3. `git add .`
4. `git commit -m "fix: melhorar fluxo de cartelas e sorteio"`
5. `git push`

A migration nova é necessária para permitir reabrir de forma auditada um evento finalizado quando ainda houver outra rodada/prêmio.
