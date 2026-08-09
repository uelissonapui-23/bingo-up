# Fase 1 — Acesso e organizador único

## Estado
Implementação funcional concluída sobre a fundação da Fase 0, mantendo a arquitetura preparada para vendedores e multi-organizadores sem bloquear o MVP.

## Entregue
- Login por e-mail e senha.
- Criação de conta de organizador.
- Recuperação e redefinição de senha.
- Sessão centralizada e logout.
- Onboarding do primeiro workspace/organizador.
- WorkspaceProvider com seleção persistida, já apto a múltiplos workspaces no futuro.
- Perfil do usuário e dados do organizador editáveis.
- Dashboard inicial responsivo.
- Navegação desktop e mobile.
- RLS reforçada para perfil e workspace.
- Preferência de último workspace.
- Auditoria via RPC para ações críticas.
- Proteção contra troca direta do proprietário e rebaixamento/revogação do owner.
- Índices adicionais para evolução.
- Testes unitários de slug e E2E da entrada.

## Mantido para fases futuras
Eventos, cartelas, vendas e sorteio continuam como placeholders. Vendedores e SaaS não foram ativados visualmente, mas a fundação de workspace, papéis, planos e assinaturas permanece preparada.

## Validação necessária no computador do projeto
1. Copiar `.env.example` para `.env.local` e preencher as chaves do Supabase.
2. Aplicar as migrations Supabase em ordem.
3. Executar `npm install`.
4. Executar `npm run check`.

A Fase 1 só deve ser publicada após estes comandos passarem no ambiente real ligado ao projeto Supabase.
