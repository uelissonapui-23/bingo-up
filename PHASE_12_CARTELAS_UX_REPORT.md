# BINGOUP — Ajuste de UX de cartelas

Este patch corrige o fluxo de cartelas identificado no teste online.

## Alterações
- A aba global **Cartelas** deixa de ser placeholder e passa a ser uma Central de Cartelas por evento.
- O gerador passa a mostrar uma **prévia visual em tempo real** da primeira cartela do lote.
- A prévia acompanha formato 1/2/3 em 1, layout, orientação, série, primeiro número, quantidade de dígitos, QR e regra selecionada.
- Cada lote concluído ganha ações visíveis:
  - Ver cartelas
  - Imprimir / PDF
- A lista de cartelas aceita o lote pela URL (`?lote=...`) e mantém o botão de impressão/PDF evidente.
- A tela de impressão passa a separar os botões **Imprimir** e **Gerar PDF**.
- Para gerar PDF, o navegador abre a janela de impressão; basta escolher **Salvar como PDF**.
- Mantida a identidade visual BINGOUP escura/vermelha já aprovada.

## Aplicação
Extrair o ZIP diretamente na raiz do projeto e substituir os arquivos existentes.

Depois executar:
npm run check

Se passar:
git add .
git commit -m "feat: melhorar geracao e impressao de cartelas"
git push
