# BINGOUP - PDF pronto e leve

## O que foi corrigido

A tela de impressão não depende mais do `window.print()` para criar o arquivo final.

Agora o botão `Baixar PDF pronto`:
- carrega somente o bloco/arquivo selecionado;
- gera um PDF real diretamente no navegador;
- já usa o tamanho da folha, orientação e quantidade de cartelas por folha escolhidos;
- aplica a arte de fundo configurada no modelo;
- respeita zoom e posição da arte;
- coloca os jogos/números por cima da arte nas áreas do layout;
- aplica o coringa escolhido;
- baixa o arquivo `.pdf` pronto para abrir e imprimir.

## Como o PDF fica leve

- a arte de fundo é transformada em JPEG otimizado somente no momento da geração;
- a arte é gravada UMA ÚNICA VEZ dentro de cada PDF e reutilizada em todas as cartelas/páginas;
- números, linhas, cabeçalhos e coringas padrão são desenhados como texto/vetores, sem transformar cada cartela inteira em imagem;
- coringa personalizado também é incorporado uma única vez;
- cada PDF continua limitado pela quantidade de folhas definida pelo usuário;
- somente o bloco atual é mantido em memória.

Isso evita o problema clássico de PDFs onde a mesma imagem de fundo é duplicada centenas de vezes.

## Fluxo da tela

1. Escolher tamanho da folha.
2. Escolher orientação.
3. Escolher cartelas por folha.
4. Escolher folhas por PDF.
5. Escolher qual PDF/parte gerar.
6. Opcional: `Pré-visualizar este PDF`.
7. `Baixar PDF pronto`.

A prévia não é obrigatória para gerar o arquivo.

## Validação

- TypeScript: PASSOU.
- ESLint dos arquivos alterados: PASSOU.

## Depois de extrair

npm run check

Se passar:

git add .
git commit -m "feat: gerar pdf pronto e leve com arte de fundo"
git push
