# BINGOUP — Correção updateCardTemplate

O patch anterior do erro 409 preservou a correção da RPC, mas substituiu
`cardConfigService.ts` por uma versão que não continha mais:
- `UpdateTemplateInput`
- `updateCardTemplate`

A tela de configuração ainda usa essa função para editar:
- imagem de fundo;
- zoom e posição da arte;
- coringa;
- layout;
- demais opções do modelo.

Esta correção restaura essas funções SEM remover a proteção contra o erro 409.

Depois de extrair:
1. npm run check
2. se passar:
   git add .
   git commit -m "fix: restaurar updateCardTemplate"
   git push

Não precisa de nova migration do Supabase para este patch.
