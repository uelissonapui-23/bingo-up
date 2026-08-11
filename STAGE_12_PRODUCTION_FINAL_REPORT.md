# BINGOUP — Etapa 12: fechamento para produção definitiva

## Objetivo
Fechar o núcleo operacional sem acrescentar regras de negócio arriscadas. Esta etapa endurece segurança pública, estabilidade do PWA e desempenho dos fluxos consultados continuamente.

## Alterações
- Cartela digital pública deixa de retornar UUIDs internos de evento, cartela e sessão.
- Leitura anônima direta de `public_panel_signals` é novamente revogada por defesa em profundidade.
- Índices adicionados para sessão atual, números chamados, candidatos pendentes e vencedores.
- Cartela digital pausa polling quando a aba está oculta e sincroniza ao voltar, reduzindo carga desnecessária.
- Error Boundary não exibe mensagens técnicas internas ao usuário final.
- Vercel passa a enviar headers mínimos de segurança e impede cache persistente de `index.html` e `sw.js`, reduzindo risco de PWA ficar preso em versão antiga.
- Testes de regressão adicionados para os itens acima.

## Aceite antes do primeiro evento real
1. `npm run lint`, `npm run typecheck`, `npm run test` e `npm run build` verdes.
2. `npx supabase db push` concluído.
3. Testar organizador, vendedor e operador com contas diferentes.
4. Testar TV por duas rodadas consecutivas, incluindo possível bingo e confirmação.
5. Testar sorteio continuado e sorteio com bolas zeradas.
6. Testar cartela digital vendida e uma não vendida.
7. Testar PDF em A4/A5 e pelo menos um lote grande.
8. Testar 360 px, 390/412 px, tablet, 1366x768 e TV/projetor.
9. Confirmar que nenhuma tela exige refresh manual para avançar.
10. Fazer backup do banco antes do primeiro evento real e antes de migrations futuras.

## Limite da etapa
Monetização, planos/licenças e novos recursos comerciais ficam fora deste fechamento. O objetivo é congelar e validar o núcleo antes de expandir novamente.
