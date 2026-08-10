# BINGOUP — Etapa 8: Auditoria de pré-produção

## Escopo auditado

Esta etapa revisa isolamento por workspace/evento, RLS, funções SECURITY DEFINER, exposição pública, PWA/cache, estabilidade de sessão/workspace, dependências e riscos de regressão antes do uso real.

## Correções aplicadas

1. **Cache autenticado removido do Service Worker.** Respostas da API do Supabase não são mais armazenadas pelo Workbox. Isso evita que uma resposta autenticada de um workspace seja reutilizada fora da sessão correta quando a rede falhar.
2. **Capability token do painel público protegido.** `public_panel_signals` não pode mais ser listado por `anon`. A TV pública atualiza por RPC tokenizada, sem depender de leitura pública da tabela de sinais.
3. **Gestão de membros endurecida.** `organizer_admin` não consegue promover usuários para `organizer_owner`; o owner real não pode ser removido/rebaixado; `workspace_id` e `user_id` de uma membership são imutáveis.
4. **Consistência evento/workspace protegida no banco.** As tabelas de domínio receberam FKs compostas `event_id + workspace_id` como `NOT VALID`: protegem imediatamente novos inserts/updates e permitem auditar legado sem bloquear a implantação.
5. **RPC de auditoria de isolamento.** `audit_workspace_isolation(workspace_id)` retorna contagens de inconsistência por tabela para owner/admin.
6. **Dependências fixadas.** Entradas `latest` foram substituídas pelas versões já presentes no `package-lock.json`, reduzindo risco de builds futuros mudarem sem revisão.
7. **Workspace resiliente.** A verificação silenciosa ficou menos agressiva e usa reconexão/foco/retorno à aba, preservando o último workspace válido em oscilações temporárias.
8. **Painel público resiliente e seguro.** Polling curto via RPC tokenizada mantém a TV atualizada mesmo sem Realtime público e não altera fullscreen automaticamente.
9. **Seleção de workspace corrigida.** A consulta de memberships agora filtra explicitamente pelo usuário autenticado. Antes, a RLS permitia ler membros do mesmo workspace e a tela podia receber linhas de outras pessoas, duplicando o workspace e exibindo papel incorreto no cliente.
10. **Cache legado removido.** Ao iniciar a nova versão, o app apaga o antigo cache `supabase-runtime` criado por versões anteriores.
11. **Carregamento inicial dividido por rota.** Telas pesadas de PDF, cartelas, sorteio, histórico e relatórios agora são carregadas sob demanda, reduzindo o JavaScript inicial e isolando falhas de módulos que o usuário nem abriu.

## Pontos observados e mantidos

- RLS está habilitado em todas as tabelas públicas do domínio.
- Escritas sensíveis de vendas, geração, sorteio e vencedor continuam concentradas em RPCs transacionais com checagem de papel/workspace.
- Exclusão direta de evento continua restrita a evento `finished` e owner/admin.
- O bucket `event-assets` é privado. O bucket `card-artworks` permanece público por requisito de renderização/PDF; os caminhos de escrita continuam limitados por workspace e papel.
- O PWA continua abrindo o shell offline, mas operações sincronizadas não são apresentadas como concluídas sem Supabase.

## Validação recomendada antes de produção inicial

1. `npm run check`.
2. `npm run test:e2e` com o app/preview disponível conforme a configuração Playwright.
3. `npx supabase db push`.
4. No SQL/RPC autenticado como owner, executar `audit_workspace_isolation(<workspace_id>)` e confirmar `ok: true`.
5. Testar troca de workspace com dois usuários e confirmar ausência de eventos/cartelas/vendas cruzados.
6. Testar logout/login com rede offline/instável e confirmar que nenhum dado antigo aparece por cache.
7. Manter TV pública aberta durante duas rodadas e confirmar atualização por polling, fullscreen estável e nenhuma exposição administrativa.
8. Testar 360px, 390/412px, tablet, 1366x768 e desktop amplo.
9. Gerar PDF A4/A5 em Chrome e Edge, com 1/2/3 cartelas por folha e guias de corte.

## Pendências não bloqueantes

- Validar as FKs `*_event_workspace_fk` depois que a RPC de auditoria retornar zero inconsistências para todos os workspaces existentes.
- Adicionar suíte E2E com dois usuários reais de teste para provar isolamento RLS no ambiente de staging.
- Medir lote grande/PDF em hardware alvo e registrar tempo/memória antes de definir limites finais de produção.
