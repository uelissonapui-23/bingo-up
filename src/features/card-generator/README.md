# Motor de geração

Fase 4 implementa o gerador de lotes. A camada de domínio calcula o plano de unicidade, gera jogos e compõe cartelas físicas. A persistência usa RPCs transacionais no Supabase, que revalidam números, assinaturas e política de repetição.

Regras centrais:
- modo `strict`: nenhum jogo já emitido pode reaparecer;
- modo `controlled`: em 2+ jogos por cartela, no máximo um jogo reaproveitado por cartela física;
- uma cartela 2/3 em 1 nunca pode repetir a composição completa;
- em 1 em 1, repetição integral só é permitida quando o usuário escolhe repetição controlada;
- cada jogo interno é armazenado uma única vez em `game_definitions` e reutilizado por referência quando necessário.
