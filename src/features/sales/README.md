# Vendas

Fase 6 implementa vendas diretas pelo organizador, reservas temporárias, venda em lote, comprador, preço, histórico e reversão auditada.

A estrutura já possui `seller_user_id` e `channel`, mas o acesso de vendedores permanece desativado até o módulo específico. Escritas são feitas por RPCs transacionais para impedir venda dupla da mesma cartela.
