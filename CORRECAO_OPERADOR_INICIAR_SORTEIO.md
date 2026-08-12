# Correção — operador convidado iniciando sorteio

A Central do Operador conseguia listar um evento atribuído, porém uma conta antiga sem registro em `platform_user_controls` era negada pelo helper `operational_user_access_allowed` ao chamar as RPCs do sorteio.

A correção passa a tratar a ausência desse registro como neutra/permitida **somente quando as demais verificações de autorização operacional são satisfeitas**: atribuição ativa ao evento, vínculo operacional ativo, workspace ativo e licença ativa. Suspensões/bloqueios explícitos continuam sendo respeitados.

Também foi melhorado o erro do frontend ao criar/preparar uma sessão para mostrar a mensagem retornada pelo Supabase em vez de apenas "Não foi possível concluir a operação".
