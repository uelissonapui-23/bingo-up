# Fase 0 — Fundação completa

## Estado
Fundação técnica revisada para o MVP de um organizador sem sacrificar a evolução para vendedores e SaaS multi-organizador.

## Incluído
- React + Vite + TypeScript e Tailwind.
- PWA com service worker, manifest e registro de atualização.
- Router com rota pública separada e guarda de autenticação.
- AuthProvider com sessão Supabase.
- Cliente Supabase e validação central das variáveis de ambiente.
- Estrutura modular definitiva (`features`, `domain`, `services`, `components`, `supabase`).
- UI base reutilizável, error boundary, estados vazios e aviso offline.
- Fundação multi-tenant no banco: profiles, platform_members, workspaces, workspace_members e audit_logs.
- Estrutura SaaS de baixo custo já criada: plans, subscriptions, workspace_settings e usage_counters.
- RLS e funções auxiliares de autorização.
- RPC transacional `create_workspace` para criar workspace + proprietário + configurações sem depender de INSERT direto inseguro.
- Assinatura canônica inicial para jogos/cartelas.
- Vitest e Playwright configurados.
- Vercel SPA fallback.
- Migrations versionadas e seed mínimo.

## Validação possível neste ambiente
A árvore, imports locais, JSON e migrations foram auditados manualmente/estruturalmente. O `npm install` não pôde ser concluído porque o registry interno deste ambiente retornou 404 para `@eslint/js`; portanto `npm run check` precisa ser executado no computador do projeto antes de iniciar o próximo módulo.

## Critério para avançar
No ambiente local: copiar `.env.example` para `.env.local`, preencher Supabase, executar `npm install`, `npm run check` e aplicar migrations. Só então iniciar a implementação funcional do Módulo 1.
