# BINGOUP — Correção de modelos, gabarito e coringa

## Problema encontrado
O gerador listava apenas os templates salvos no banco. A função antiga do Supabase criava somente um template para cada formato:
- 1 em 1
- 2 em 1
- 3 em 1

Por isso, apesar de o código já possuir vários presets visuais, apenas um modelo aparecia em cada formato.

## Correções
- Atualizada a função de inicialização do Supabase para disponibilizar 3 modelos oficiais para cada formato.
- 1 em 1:
  - Destaque
  - Jogo inferior
  - Compacto
- 2 em 1:
  - Dois grandes
  - Principal + apoio
  - Lado a lado
- 3 em 1:
  - Principal + 2
  - Empilhados
  - Equilibrado
- Templates automáticos antigos são convertidos para os novos nomes/chaves sem apagar layouts personalizados.
- No próprio gerador agora aparece:
  - botão `Gerar gabarito PNG`;
  - botão `Arte e coringa`;
  - indicação do coringa atual.
- `Arte e coringa` abre diretamente a aba de layouts, onde é possível:
  - importar arte;
  - ajustar zoom e posição;
  - escolher estrela, bola, coração, símbolo, fogueira, futebol, nenhum ou imagem personalizada;
  - alterar o tamanho do coringa;
  - baixar o gabarito.

## Aplicação
1. Extraia na raiz do projeto.
2. Rode:
   npm run check
3. Aplique a migration:
   npx supabase db push
4. Atualize a página do gerador. Ao carregar o evento, o sistema cria automaticamente os modelos que ainda não existem.
5. Publique:
   git add .
   git commit -m "fix: liberar modelos gabarito e coringa"
   git push

## Validação
- TypeScript: aprovado.
- ESLint: aprovado.
