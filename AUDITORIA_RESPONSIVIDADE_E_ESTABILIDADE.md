# Auditoria de responsividade e estabilidade — BINGOUP

Data: 2026-08-09

## Escopo
Revisão do projeto recebido `BINGO(2).zip`, cobrindo navegação, responsividade, telas de operação, geração/impressão de cartelas, PWA, possíveis cortes de conteúdo e riscos de travamento no navegador.

## Correções aplicadas
- Navegação de celular/tablet: criado menu lateral móvel com acesso a **todas** as áreas. Antes, Cartelas e Configurações ficavam inacessíveis em larguras abaixo de 1024px pela navegação principal.
- Proteção global contra overflow horizontal, palavras/códigos longos e flex/grid estourando a largura.
- Header adaptativo para 320px+, com logo e controles que encolhem sem se sobrepor.
- Botões, badges, inputs, selects e textareas preparados para quebrar/encolher corretamente.
- Dashboard, eventos, cartelas, vendas, sorteio, painel público e tela de conferência revisados para ações que quebram linha em telas estreitas.
- Editor de faixas de regras: 2 colunas no celular e 4 em telas maiores.
- Prévia 2/3 em 1: deixa de esmagar grades em telas pequenas; reorganiza a miniatura sem sair da tela.
- Painel público: quadro numérico cai para 5 colunas em telas pequenas e volta a 10 quando há largura suficiente.
- PWA: popup de instalação centralizado e seguro em celular; nome atualizado para BINGOUP.
- Erro de lint: removido import obsoleto `ModulePlaceholderPage`.
- Vendas: seleção é reconciliada ao recarregar filtros para evitar manter IDs invisíveis/indisponíveis; resumo ganhou tipo explícito; textos e ações não transbordam.
- Geração: limite operacional por lote de 10.000 cartelas no navegador para impedir travamentos/memória excessiva. A capacidade matemática e a unicidade entre lotes continuam intactas.
- Impressão/PDF: lotes grandes agora são carregados por faixa, com máximo de 500 cartelas por trabalho de impressão. Evita congelar celular/computador e URLs/consultas enormes.
- Impressão com QR: botões só ficam prontos quando os QR Codes da faixa terminaram de ser preparados, evitando PDF com QR ausente.
- Consulta de jogos para impressão dividida em blocos menores, evitando falhas por listas `IN` muito grandes no PostgREST.

## Pontos acompanhados / evolução futura
- O gerador continua client-side. Para volumes muito grandes e SaaS em alta escala, a evolução correta é mover a geração pesada para job/worker de backend mantendo o mesmo modelo de banco. O limite operacional atual protege o MVP sem alterar as regras de unicidade.
- A tela de listagem de cartelas retorna até 500 por consulta para não carregar milhares de elementos simultaneamente; busca e filtros continuam sendo aplicados no banco. Paginação/infinite scroll pode ser adicionada quando necessário.
- A rota pública `/c/:token` ainda é placeholder por decisão de roadmap (cartela digital futura); o QR físico permanece preparado para essa expansão.

## Validação
Executar `npm run check` após aplicar o patch. O projeto usa GitHub Actions, então cada push para `main` também repete typecheck, lint, testes e build.
