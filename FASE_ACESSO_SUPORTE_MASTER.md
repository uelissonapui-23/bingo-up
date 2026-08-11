# BINGOUP — Acesso pendente e suporte Master

## Objetivo
Novas contas de organizador passam a aguardar liberação comercial antes de acessar as funções operacionais. A tela de espera mostra mensagem configurável, WhatsApp e atendimento interno com anexos.

## Regras implementadas
- Usuários existentes são preservados como ativos caso ainda não tenham controle global explícito.
- Novos usuários recebem `platform_user_controls.access_status = suspended` automaticamente.
- O `platform_owner` continua sempre acessível.
- O frontend impede acesso às rotas operacionais enquanto a conta estiver suspensa.
- `create_workspace` também valida a liberação no banco, impedindo bypass por chamada direta.
- Vendedor/operador que aceita convite válido é liberado apenas se o bloqueio ainda for o bloqueio inicial automático. Bloqueio manual do Master não é removido.
- Novo workspace liberado começa com plano conservador de 1 evento. O Master pode ampliar depois.

## Atendimento
A aba `Suporte` do `/master` permite:
- editar título e mensagem exibidos ao usuário bloqueado;
- configurar WhatsApp;
- ativar/desativar o chat interno;
- ver conversas e mensagens não lidas;
- responder e anexar comprovantes/arquivos;
- encerrar/reabrir atendimento.

O usuário bloqueado pode:
- chamar no WhatsApp;
- enviar mensagem ao Master;
- anexar PNG, JPG, WebP ou PDF de até 8 MB;
- receber respostas sem sair da tela de espera.

## Segurança
- Bucket `platform-support` é privado.
- Downloads usam URL assinada de curta duração.
- Usuário só acessa arquivos da própria conversa.
- Master pode acessar todos os atendimentos.
- RPCs críticas validam `auth.uid()` e `platform_owner` no banco.

## Migration
`20260811180000_pending_access_support_center.sql`
