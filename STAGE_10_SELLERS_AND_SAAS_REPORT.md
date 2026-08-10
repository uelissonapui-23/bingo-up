# Etapa 10 — Vendedores e evolução multi-organizador

## Entregue
- Convite de vendedor por e-mail com link único e validade.
- Aceite do convite somente pela conta autenticada com o mesmo e-mail.
- Vendedor com login próprio e membership `seller`.
- Vínculo de vendedor por evento, podendo atuar em vários eventos quando autorizado.
- Tela `/vendedores` para proprietário/administrador convidar, suspender, reativar, revogar e editar eventos permitidos.
- Histórico e total de vendas por vendedor.
- Vendas registradas com `channel='seller'` e `seller_user_id`.
- Vendedor visualiza somente os eventos atribuídos e suas próprias operações de venda.
- Vendedor não recebe acesso ao motor de jogos, impressão, sorteio, progresso, candidatos ou vencedores.
- Dashboard e relatório completo continuam exclusivos da equipe organizadora.
- Navegação do vendedor reduzida a Vendas e Configurações.
- Suporte visual para troca de workspace quando uma conta participa de mais de um organizador.

## Segurança
- RLS de eventos, configurações, lotes e cartelas passa a considerar vínculo explícito do vendedor ao evento.
- Dados administrativos, sorteio, conferência e relatórios não ficam disponíveis ao papel `seller`.
- Convite não pode converter uma conta que já possua papel organizador em vendedor.
- Escritas de venda continuam em RPC transacional e preservam bloqueio contra venda dupla.
- Suspender/revogar vendedor desativa seus vínculos de evento.

## Fluxo
1. Proprietário/admin acessa **Vendedores**.
2. Informa o e-mail e seleciona os eventos permitidos.
3. O sistema gera e copia o link de convite.
4. O vendedor entra/cria a conta com o mesmo e-mail e aceita o convite.
5. A conta passa a abrir diretamente a área de vendas.
6. Apenas eventos autorizados aparecem.
7. As vendas ficam vinculadas ao vendedor para relatório.

## Migration
`20260810230000_stage10_sellers_and_event_permissions.sql`

## Validação local
- TypeScript: OK.
- ESLint dos arquivos alterados: OK.
- `git diff --check`: OK.
- Vitest/build completos dependem do binding Linux do Rolldown, ausente no `node_modules` recebido do Windows. Executar a validação definitiva no Windows antes do push.
