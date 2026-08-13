# Correção da cartela digital do comprador

Causa identificada no projeto atual: a RPC `get_my_buyer_digital_card` tentava ler `r.has_free_center`, porém a coluna real de `public.bingo_rule_sets` se chama `free_center`.

A migration desta correção recria a RPC usando `r.free_center` e mantém a chave JSON `has_free_center` esperada pelo frontend.

Aplicar com `npx supabase db push`.
