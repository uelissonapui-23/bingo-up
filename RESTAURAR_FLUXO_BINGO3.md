# BINGOUP — Restaurar fluxo como no BINGO(3)

O projeto BINGO(3) enviado não possui a barra de passo a passo/fluxo persistente nas telas operacionais.

Este patch neutraliza completamente o componente `EventFlowNav`, sem desfazer as melhorias mais recentes de:
- prévia real da cartela;
- expansão da cartela;
- PDF pronto;
- arte/coringa;
- exclusão de lotes;
- correções de sorteio.

Assim, qualquer tela que ainda chame `EventFlowNav` deixa de exibir essa barra, retornando visualmente ao comportamento do BINGO(3).

Depois de extrair:
npm run check

Se passar:
git add .
git commit -m "fix: restaurar fluxo simples do BINGO3"
git push
