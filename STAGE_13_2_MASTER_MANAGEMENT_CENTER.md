# BINGOUP — Fase 13.2 — Central Master de gestão

A área `/master` foi reorganizada para uso diário e separada em seis áreas: Visão geral, Clientes, Usuários, Planos, Marca e Auditoria.

## Segurança
- Somente `platform_owner` acessa a central.
- Suspensão de cliente não apaga dados.
- Bloqueio global de usuário invalida acessos por workspace, vendedor e operador.
- A conta `platform_owner` não pode ser bloqueada pela própria central.
- O proprietário de um workspace não pode ser rebaixado ou suspenso pela edição de vínculo; para bloquear o cliente, usa-se a licença do workspace.

## Comercial
- Planos cadastráveis com limite de eventos e preço de referência.
- Planos iniciais: evento avulso, pacote 3, pacote 5 e ilimitado.
- Cada cliente pode usar plano ou configuração personalizada, validade e observações comerciais.

## Operação Master
- Busca e filtro de clientes.
- Busca e filtro de usuários.
- Bloqueio/desbloqueio global.
- Ajuste de função/status por workspace.
- Identidade global isolada da gestão comercial.
- Log das ações Master.
