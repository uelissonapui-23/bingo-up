# BINGOUP — Auditoria final de segurança e isolamento

## Escopo revisado
- Master / platform_owner
- Organizador e workspaces
- Vendedor multi-evento
- Operador multi-evento
- Comprador digital
- Convites e atribuições
- Rotas autenticadas por papel
- RPCs SECURITY DEFINER e RLS de dados operacionais
- Painel público e cartela pública

## Correções aplicadas nesta etapa
1. As funções auxiliares de vendedor/operador não podem mais ser usadas por uma conta comum para consultar a permissão de outro usuário.
2. A função interna de controle operacional deixou de ser executável diretamente pelo cliente autenticado.
3. Vínculos operacionais e controles globais permanecem graváveis somente pelas RPCs autorizadas/auditadas.
4. O comprador autenticado só abre a central de uma compra quando o e-mail do Auth está confirmado e coincide com uma venda concluída.
5. As URLs de evento de vendedor, operador e comprador ganharam uma segunda barreira no frontend; o banco continua sendo a autoridade final.

## Isolamento esperado
- Organizador: somente workspaces em que possui papel permitido e licença ativa.
- Vendedor: somente eventos presentes em event_seller_assignments ativos.
- Operador: somente eventos presentes em event_draw_operator_assignments ativos.
- Comprador: somente eventos com venda concluída para o e-mail confirmado da própria conta.
- Master: acesso global somente quando is_platform_owner() é verdadeiro.

## Pontos públicos intencionais
- /painel-publico/:token e get_public_panel_state(uuid): leitura pública por token não enumerável.
- /c/:token e get_public_digital_card(uuid): leitura pública da cartela vendida por token não enumerável, sem UUIDs internos sensíveis.
- Branding global: leitura pública intencional.

## Dependências operacionais a validar antes de clientes reais
- Supabase Auth com confirmação de e-mail habilitada.
- Site URL e Redirect URLs corretas no Supabase.
- Todas as migrations aplicadas em produção.
- Testar uma conta acumulando papéis em workspaces distintos.
- Testar alteração manual de IDs nas URLs de /venda, /operador e /cliente.
- Confirmar que bloqueio/suspensão do Master não apaga dados históricos.

## Critério de aprovação
A versão pode seguir para homologação comercial quando lint, typecheck, testes e build passarem e os testes manuais de troca de IDs entre dois organizadores diferentes forem bloqueados.
