# Fase 5 — Cartelas e Impressão

## Entregue
- Catálogo de cartelas por evento, lote, status e código.
- Tela individual com os jogos reais gerados na Fase 4.
- Layout 1 em 1, 2 em 1 e 3 em 1 respeitando o template escolhido.
- Banner do evento reutilizado na cartela sem interferir na matemática.
- QR Code real baseado no `public_token`, já apontando para a futura rota pública `/c/:token`.
- Impressão individual e impressão de lote.
- Geração de PDF pela opção nativa “Salvar como PDF” do navegador.
- Registro de impressão (`card_print_jobs`, `print_count`, datas de primeira/última impressão).
- Anulação segura e auditável somente para cartela ainda disponível.
- Números, composição, regra e lote continuam imutáveis após a emissão.
- Estrutura pronta para a Fase 6 de vendas sem remodelar `physical_cards`.

## Segurança e integridade
- RLS para histórico de impressão.
- RPC `register_card_print` valida workspace, papel, lote concluído e seleção de cartelas.
- RPC `void_physical_card` permite anulação apenas para cartela `available` e registra auditoria.
- O QR usa token público aleatório, não um ID sequencial.

## Observação de validação
O ambiente desta conversa não fornece instalação npm confiável para executar a cadeia completa. A estrutura foi revisada e os imports locais foram validados; `npm run check` deve ser executado na máquina do projeto antes do deploy.
