# Correção de responsividade — Fase 12.2

Causa principal encontrada no print:
- `.bingoup-mobile-nav` definia `display:grid` no CSS global e sobrescrevia o `lg:hidden` do Tailwind. Por isso a barra móvel aparecia ao mesmo tempo que a sidebar desktop.
- O breakpoint da sidebar em 1024px deixava pouco espaço útil em notebooks/telas intermediárias.
- O topbar sticky permitia conteúdo visualmente passar por baixo durante a rolagem.
- Alguns grupos de ações não tinham proteção suficiente para quebra em larguras intermediárias.

Correções:
- Sidebar somente a partir de 1280px.
- Entre 768px e 1279px: layout de tablet sem sidebar fixa e sem barra inferior; navegação pelo botão de menu.
- Abaixo de 768px: barra inferior com Início, Eventos, Cartelas, Vendas e Mais.
- Drawer móvel/tablet contém todas as áreas, inclusive Sorteio, Histórico e Configurações.
- Topbar deixa de sobrepor conteúdo.
- Espaçamentos e paddings separados para celular, tablet e desktop.
- Textos longos passam a quebrar sem estourar cards.
- Botões de eventos recentes quebram corretamente.
- Conteúdo principal tem largura máxima e `overflow-x` protegido.

Depois de extrair:
npm run check
git add .
git commit -m "fix: eliminar sobreposicoes responsivas"
git push
