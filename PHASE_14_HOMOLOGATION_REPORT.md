# BINGOUP — Fase 14 — Homologação para venda

## Objetivo
Fechar a validação comercial do núcleo sem adicionar regras de negócio ao sorteio, vendas ou cartelas.

## Implementado
- Aba **Homologação** exclusiva no painel Master.
- Diagnóstico automático e somente leitura do banco: conta Master, licenças ausentes, conferências pendentes, suporte, acessos pendentes e sessões abertas.
- Checklist manual de 10 fluxos reais: Master, novo usuário bloqueado, suporte/comprovante, licença, vendedor, operador, TV, sorteio, cartela digital e evento completo.
- O checklist manual usa `localStorage`; não altera dados do evento nem cria uma falsa aprovação centralizada.
- Teste unitário de regressão para impedir remoção das proteções principais.

## Critério de aceite
1. `npm run check` verde.
2. `npx supabase db push` concluído.
3. Aba Master > Homologação sem itens críticos.
4. 10/10 testes manuais executados em contas/dispositivos reais.
5. Somente então iniciar venda comercial controlada.
