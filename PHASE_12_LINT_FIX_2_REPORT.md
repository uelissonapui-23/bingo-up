# Fase 12 — Ajuste de lint 2

- Removido o `setState` síncrono dentro de `useEffect` no onboarding do workspace.
- O slug automático agora é derivado diretamente do nome até o usuário editar o campo manualmente.
- Tratamento de erro alterado de `any` para `unknown`.
- Configuração do `eslint-plugin-react-hooks` ajustada para o escopo real do projeto: regras fundamentais `rules-of-hooks` e `exhaustive-deps` continuam obrigatórias; regras específicas do React Compiler não são ativadas enquanto o projeto não adotar React Compiler.
- TypeScript strict e demais regras recomendadas continuam ativos.
