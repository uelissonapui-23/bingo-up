# Correção — persistência da arte na criação de cartelas

- Corrige a policy do bucket de suporte que podia interferir no upload do bucket `card-artworks` e gerar `permission denied for table platform_support_threads`.
- Mantém a imagem escolhida em memória enquanto o organizador alterna entre 1 em 1, 2 em 1, 3 em 1 e os modelos de layout.
- Depois de salvar a arte, ela continua sendo a arte compartilhada do evento e aparece na personalização da grade, geração, miniatura real e PDF.
- Não altera lotes/cartelas já gerados.
