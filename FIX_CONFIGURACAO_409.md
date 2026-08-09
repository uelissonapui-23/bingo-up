# BINGOUP — Correção do erro 409 na configuração

## Causa
A RPC `ensure_event_card_defaults` retornava HTTP 409 quando tentava converter um template antigo para um nome que já existia entre os presets novos.

O banco possui `unique (event_id, name)` em `card_templates`, portanto o `UPDATE` podia gerar uma violação de unicidade (`23505`).

## Correção
- Torna `ensure_event_layout_presets` idempotente.
- Não renomeia presets antigos quando isso causaria colisão.
- Mantém templates antigos já usados por lotes, apenas desativando o legado quando o novo correspondente existe.
- Cria somente presets realmente ausentes.
- Garante um modelo padrão por formato sem duplicação.
- Torna `ensure_event_card_defaults` segura para chamadas repetidas.
- O frontend não bloqueia a tela se encontrar especificamente uma colisão legada `23505` durante a transição.

## Validação
- TypeScript / typecheck: PASSOU.

## Depois de extrair
1. `npm run check`
2. `npx supabase db push`
3. Atualizar a página com Ctrl+F5.
4. Se funcionar:
   `git add .`
   `git commit -m "fix: corrigir conflito 409 da configuracao"`
   `git push`
