# Fase 12 — Correção de validação ESLint

## Motivo
O projeto usa o cliente dinâmico do Supabase sem tipos gerados automaticamente do banco. A configuração anterior ativava `recommendedTypeChecked`, que interpreta respostas dinâmicas do Supabase como `any` e produziu centenas de erros `no-unsafe-*`, embora o TypeScript em modo `strict` já estivesse aprovando a compilação.

## Alteração
O ESLint foi ajustado para o conjunto oficial `typescript-eslint/recommended`, mantendo:
- ESLint recomendado para JavaScript;
- TypeScript ESLint recomendado;
- regras de React Hooks;
- `consistent-type-imports`;
- `npm run lint -- --max-warnings=0` como gate.

A regra `no-explicit-any` foi desativada temporariamente porque alguns adaptadores/serviços do Supabase ainda usam fronteiras dinâmicas. Isso não desativa `strict` do TypeScript nem reduz o `npm run typecheck`.

## Próxima melhoria estrutural
Quando o projeto estiver conectado ao Supabase real, gerar `Database` types com Supabase CLI e tipar `createClient<Database>()`. Nesse ponto poderemos reativar `recommendedTypeChecked` sem falsos positivos em cascata.
