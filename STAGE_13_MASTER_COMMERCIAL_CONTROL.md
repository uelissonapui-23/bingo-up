# Fase 13 — Master comercial e monetização manual

Esta fase cria uma camada de administração global separada dos workspaces.

## Segurança
- `/master` exige autenticação e `platform_members.role = platform_owner`.
- `platform_admin`, organizador, vendedor e operador NÃO recebem Master automaticamente.
- Todas as mutações de licença e identidade são novamente validadas no banco por RPC `security definer`.
- Alterações Master ficam em `platform_master_audit_logs`.

## Licenciamento
- Status: ativo, suspenso ou expirado.
- Limite de eventos: 1, N ou ilimitado.
- Validade opcional.
- Suspender não apaga dados; bloqueia o workspace para usuários comuns.
- O limite é validado por trigger no banco, não apenas na interface.
- Workspaces existentes são migrados como ativos/ilimitados para evitar quebra.
- Workspaces novos também começam ativos/ilimitados até a política comercial ser definida no Master.

## Branding global
- Nome da plataforma.
- Logo principal.
- Logo de autenticação.
- Ícone compacto.
- Logo da TV pública.
- Assets ficam no bucket público `platform-branding`; apenas platform_owner pode escrever.

## Ativação da conta Master
`MASTER_ACCOUNT_SETUP.sql` é intencionalmente separado da migration. Isso evita promover automaticamente uma conta errada durante deploy. Substitua `evoriagerenciamentodeeventos@gmail.com` pelo e-mail exato e execute uma única vez no SQL Editor do Supabase.
