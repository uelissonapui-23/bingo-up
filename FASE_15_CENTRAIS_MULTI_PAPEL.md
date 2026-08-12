# Fase 15 — Centrais multi-papel

Uma única conta Auth pode acumular acessos independentes. A licença comercial continua exclusiva do organizador; vendedor, operador e comprador usam apenas os eventos atribuídos/comprados.

Rotas: `/acessos`, `/venda`, `/operador`, `/cliente`.

O comprador é vinculado pelas vendas concluídas cujo `buyer_email` coincide com o e-mail confirmado da conta. A central mostra cartelas compradas em vários eventos, abre a cartela digital, permite impressão e acompanha o painel público. Vitória confirmada gera aviso personalizado apenas na área autenticada do comprador.
