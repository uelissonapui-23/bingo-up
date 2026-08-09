# BINGOUP — Fluxo simplificado + exclusão segura de lotes

## O que foi corrigido

### Navegação do evento
A antiga barra "Fluxo do evento" parecia uma barra de progresso persistente, mas na prática apenas destacava a página atual. Isso dava a sensação de que o sistema resetava e nunca chegava ao fim.

Ela foi substituída por **Atalhos do evento**:
- Configurar cartela
- Gerar cartelas
- Cartelas / PDF
- Vendas
- Sorteio
- Histórico

Agora a interface deixa claro que são atalhos de navegação, não etapas que precisam ficar "concluídas".

### Continuação natural após gerar
Em um lote concluído, a ação principal agora é:
**Continuar: Imprimir / PDF →**

### Excluir lote de teste
Lotes gerados por engano ou durante testes agora têm:
**Excluir lote de teste**

A exclusão é protegida pelo banco:
- bloqueia se alguma cartela já estiver vinculada a venda/reserva;
- bloqueia se alguma cartela já participou de sorteio ou premiação;
- remove cartelas e vínculos do lote;
- limpa somente definições de jogos que realmente ficaram órfãs;
- preserva jogos que também são usados por outros lotes;
- registra a exclusão no audit log.

Assim o contador de jogos únicos também volta ao valor correto após excluir um lote de teste.

## Validação
- TypeScript: PASSOU
- ESLint: PASSOU

## Aplicação
1. Extrair na raiz do projeto.
2. Rodar `npm run check`
3. Rodar `npx supabase db push`
4. Publicar:
   - `git add .`
   - `git commit -m "fix: simplificar fluxo e permitir excluir lotes de teste"`
   - `git push`
