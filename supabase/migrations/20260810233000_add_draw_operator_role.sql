-- Etapa 10.1: papel específico para operador de sorteio.
-- Separado em migration própria para o novo valor do enum ser comprometido antes de ser usado.
alter type public.workspace_role add value if not exists 'draw_operator';
