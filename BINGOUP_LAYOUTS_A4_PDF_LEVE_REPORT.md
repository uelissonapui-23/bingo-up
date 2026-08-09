# BINGOUP — Motor de layouts A4 + arte importada + impressão leve

## Implementado

- Novas famílias de layout 1 em 1, 2 em 1 e 3 em 1 inspiradas estruturalmente nas referências enviadas.
- Todas as cartelas usam proporção A4.
- Layouts com um jogo principal grande e jogos secundários menores.
- Cada área usa um jogo interno diferente da mesma cartela física.
- Gabarito PNG contém SOMENTE os retângulos onde o BINGOUP imprimirá cada jogo.
- Importação da arte pronta do usuário como fundo da cartela.
- Zoom horizontal/vertical e posicionamento da arte em tempo real.
- Otimização automática da arte para WebP antes do upload.
- Perfis: Arquivo leve, Impressão padrão e Alta qualidade.
- Símbolo coringa configurável: estrela, bola, coração, símbolo, fogueira, futebol, nenhum ou imagem personalizada.
- Imagem de coringa personalizada também é otimizada antes do upload.
- Storage separado `card-artworks` com políticas por workspace.
- A arte fica no Storage; o banco guarda somente caminho e transformações, evitando registros pesados.

## Impressão / PDF

A tela de impressão agora pergunta:

- tamanho da folha: A5, A4, A3, Carta ou Ofício/Legal;
- orientação: retrato ou paisagem;
- quantidade de cartelas por folha;
- quantidade máxima de folhas em cada PDF;
- qual parte/arquivo PDF será preparada.

O sistema:
- calcula a melhor grade de imposição;
- mostra o tamanho aproximado de cada cartela impressa;
- calcula quantidade total de folhas e arquivos;
- carrega somente o bloco do PDF atual;
- limita cada PDF a no máximo 50 folhas;
- evita carregar milhares de cartelas de uma vez;
- consulta jogos em blocos menores para evitar URLs/queries excessivas;
- registra impressão em blocos;
- reutiliza a mesma arte de fundo otimizada.

## Validação executada neste ambiente

- TypeScript / typecheck: PASSOU.
- ESLint: PASSOU.
- Vitest/build: não puderam iniciar porque o ZIP enviado contém node_modules do Windows e o ambiente de validação é Linux; falta o binding Linux do Rolldown. Rode `npm run check` no Windows/GitHub Actions.

## Depois de extrair

1. `npm run check`
2. `npx supabase db push`
3. `git add .`
4. `git commit -m "feat: motor de layouts A4 e impressao leve"`
5. `git push`

A migration nova cria o bucket e as políticas necessárias para artes e coringas personalizados.
