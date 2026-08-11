# BINGOUP — Auditoria técnica e correções preventivas

Data: 2026-08-11
Base analisada: BINGO(6).zip

## Escopo revisado
Frontend React/TypeScript, autenticação, providers, rotas, serviços Supabase, painel público, painel Master, migrations, RLS/helpers de autorização, concorrência do limite comercial, uploads de branding, PWA/Vercel e testes existentes.

## Problemas corrigidos

### ALTO — suspensão de platform_admin não era efetiva
O painel Master permitia suspender um usuário platform_admin, porém os helpers `is_workspace_member` e `has_workspace_role` davam bypass imediato por `is_platform_admin()`. Na prática, um platform_admin suspenso ainda podia atravessar as regras normais de workspace.

Correção: `platform_owner` continua com bypass de emergência; `platform_admin` agora precisa passar por `platform_user_access_allowed` antes do acesso global. O mesmo princípio foi aplicado aos helpers de vendedor e operador.

### ALTO — corrida no limite de eventos do plano
O trigger comercial contava eventos e depois permitia INSERT sem serializar criações concorrentes. Duas requisições simultâneas podiam observar o mesmo contador e ultrapassar `event_limit`.

Correção: lock transacional da linha do workspace (`FOR UPDATE`) antes de validar/contar eventos. Criações concorrentes do mesmo workspace passam a ser serializadas.

### MÉDIO — papel organizer_owner podia divergir do owner real
`master_update_membership` permitia atribuir `organizer_owner` a um membro que não era `workspaces.owner_user_id`, criando dois conceitos de proprietário e comportamento inconsistente nas proteções.

Correção: `organizer_owner` fica reservado ao proprietário real. Transferência de propriedade deve ser uma operação própria no futuro, atômica e auditada.

### MÉDIO — painel Master falhava inteiro quando uma área falhava
O carregamento usava `Promise.all`. Uma falha em auditoria, branding, usuários ou planos derrubava o carregamento das demais áreas.

Correção: `Promise.allSettled`; cada área válida continua disponível e o painel informa apenas as áreas que não atualizaram.

### MÉDIO — upload de branding aceitava SVG e não limitava tamanho
O frontend aceitava SVG e o serviço não validava MIME/tamanho. Para uma área administrativa de branding isso amplia superfície de conteúdo ativo e uploads excessivos.

Correção: somente PNG/JPEG/WebP, máximo 5 MB, extensão derivada do MIME e nome aleatório.

## Pontos revisados sem alteração destrutiva
- RLS permanece habilitado nas tabelas centrais e as operações administrativas continuam protegidas no banco, não apenas na interface.
- O Master continua exclusivo de `platform_owner` na rota e nas RPCs administrativas.
- Nenhuma tabela, evento, cartela, venda, sorteio ou histórico existente é apagado pela migration.
- Índices de eventos, cartelas, vendas, sorteios, candidatos e atribuições já cobrem os filtros operacionais principais.
- PWA não configura cache runtime para dados autenticados do Supabase; `index.html` e `sw.js` possuem `no-cache` no Vercel.
- Não foi encontrada service-role/chave privada hardcoded no frontend durante a varredura estática.

## Arquivos alterados
- `src/features/master/MasterPage.tsx`
- `src/features/master/masterService.ts`
- `supabase/migrations/20260811170000_audit_security_concurrency_hardening.sql`
- `tests/unit/auditFinalHardening.test.ts`

## Validação neste ambiente
- TypeScript: APROVADO (`npm run typecheck`, após remover cache tsbuildinfo para forçar recompilação).
- ESLint: APROVADO (`npm run lint`).
- `git diff --check`: APROVADO para as alterações entregues.
- Vitest/build: NÃO EXECUTÁVEIS neste Linux com o `node_modules` recebido, pois o ZIP contém os bindings nativos do Rolldown para Windows e não contém `@rolldown/binding-linux-x64-gnu`. A tentativa de instalar o binding Linux expirou por indisponibilidade/limite de rede do ambiente. Isso deve ser validado no Windows do projeto com `npm run test` e `npm run build`.

## Aplicação
1. Extrair o ZIP de correção na raiz do projeto.
2. `npm run lint`
3. `npm run typecheck`
4. `npm run test`
5. `npm run build`
6. `npx supabase db push`
7. Publicar no Git somente se todas as validações locais passarem.
