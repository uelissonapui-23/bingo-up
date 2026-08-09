# Fase 5 — Cartelas e impressão

Este módulo consome as emissões imutáveis da Fase 4 e oferece consulta por evento/lote/status/código, visualização real dos jogos internos, impressão individual e em lote, QR de identificação preparado para a futura cartela digital, banner do evento e anulação auditável.

A geração de PDF usa a impressão nativa do navegador (`Imprimir / Salvar como PDF`), evitando depender de renderização de PDF no servidor e mantendo a mesma composição visual da cartela. O registro de impressão é persistido no Supabase.
