# Correção de validação da Fase 12

## Problema identificado
O TypeScript e o ESLint já passavam, porém cinco suítes do Vitest falhavam antes de executar os testes porque o alias `@/` existia no TypeScript e no Vite, mas não estava configurado no `vitest.config.ts`.

## Correção aplicada
O `vitest.config.ts` agora define o mesmo alias usado pela aplicação:

- `@` -> `<raiz>/src`

Com isso, imports como `@/domain/cards/capacity`, `@/domain/draw/board`, `@/features/events/eventSchema`, `@/domain/draw/progress` e `@/domain/cards/signature` podem ser resolvidos pelo Vitest.

## Próxima validação
Executar na raiz do projeto:

`npm run check`

A execução deve avançar novamente por typecheck, lint, testes e build. Qualquer falha restante deve ser tratada antes do push para o GitHub.
