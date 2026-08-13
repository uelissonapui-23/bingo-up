# Correção: operador recebia `workspace access denied`

Causa: as funções de sorteio já aceitavam o operador por atribuição de evento, mas a cadeia interna ainda chamava `log_audit`, que exige `workspace_members`. Operadores da Fase 15 são vínculos operacionais e não devem ser promovidos a membros completos do workspace.

Correção: auditoria operacional específica por evento, limpeza segura de reservas expiradas e regravação das RPCs do sorteio/conferência para usar o helper correto.
