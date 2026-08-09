# BINGOUP — Fluxo limpo + prévia REAL da cartela

## Mudança principal de navegação
A barra de passo a passo/atalhos foi REMOVIDA das telas do evento.
Ela continuava parecendo um processo obrigatório e deixava a experiência confusa.

Agora cada tela mostra somente as ações que fazem sentido naquele momento:
- Configuração: salvar/personalizar;
- Geração: gerar e conferir lote;
- Lote concluído: ver cartelas, conferir miniatura real, imprimir/PDF ou excluir teste;
- Vendas: registrar venda;
- Sorteio: ações da rodada;
- Histórico: consultar histórico.

## Prévia real antes do PDF
Cada lote concluído agora carrega a PRIMEIRA CARTELA REAL do lote:
- números reais;
- layout realmente salvo;
- imagem de fundo realmente configurada;
- coringa realmente configurado.

Ela aparece como miniatura dentro do lote.

Botão:
`Expandir e conferir detalhes`

Ao abrir:
- modal em tela cheia;
- cartela em proporção A4;
- zoom visual grande para conferir alinhamento, arte, números e coringa.

## Tela de impressão/PDF
Ao entrar para gerar PDF, uma miniatura REAL da cartela já aparece automaticamente no topo.
Não é mais necessário clicar em prévia só para saber como a cartela ficou.

A antiga prévia passou a se chamar:
`Prévia das folhas`
e serve somente para conferir a imposição no papel (quantas cartelas por folha).

## Aplicação
Extraia na raiz e substitua os arquivos.

Depois:
npm run check
git add .
git commit -m "fix: remover fluxo confuso e adicionar previa real"
git push

Não há migration nova neste patch.
