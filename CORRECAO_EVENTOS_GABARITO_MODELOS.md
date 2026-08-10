# Correção de eventos + gabarito + biblioteca de modelos

- Corrige a ambiguidade PostgREST introduzida pelas FKs compostas da Etapa 8, que podia impedir listar/abrir eventos.
- Mantém o isolamento workspace/evento por trigger, sem criar relacionamentos duplicados para o Data API.
- Recoloca no fluxo de criação o botão **Baixar gabarito deste modelo**.
- Amplia a biblioteca oficial para 8 layouts 1 em 1, 10 layouts 2 em 1 e 10 layouts 3 em 1.
- Inclui testes de contagem, limites geométricos e proteção contra regressão do embed events/event_settings.

Esta atualização possui migration e requer `npx supabase db push` depois dos testes locais.
