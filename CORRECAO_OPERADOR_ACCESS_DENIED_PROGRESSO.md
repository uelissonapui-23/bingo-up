# Correção do operador — access denied após iniciar sorteio

A sessão estava sendo criada, mas o frontend executa `refresh_draw_progress(id)` logo em seguida.
A RPC externa já aceitava operador, porém `evaluate_draw_session_progress` ainda exigia `is_workspace_member`, causando o erro genérico `access denied`.

Também foi corrigida `evaluate_draw_number_impact`, usada a cada nova bola, para evitar que o mesmo erro apareça imediatamente depois.

O operador continua sem virar membro administrativo do workspace: o acesso é restrito ao evento atribuído por `draw_operator_has_event_access`.
