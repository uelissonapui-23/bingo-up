# Correção do patch de prévia real

O erro TS1005/TS1109 foi causado pela remoção automática do componente de fluxo:
alguns imports ficaram colados com declarações `type/const`, e dois JSX ficaram como `{eventId&&}` / `{paramEventId&&}`.

Correções aplicadas:
- imports separados corretamente;
- JSX inválido removido;
- mantida a remoção do fluxo confuso;
- mantida a miniatura real da cartela nos lotes;
- mantida a visualização ampliada antes do PDF;
- mantida a miniatura real também na tela de impressão.

Validação:
- `npm run typecheck`: PASSOU neste ambiente.
- lint não pôde ser executado aqui por permissão do binário ESLint no node_modules copiado do Windows.

Depois de extrair:
1. npm run check
2. se passar:
   git add .
   git commit -m "fix: corrigir preview real e typecheck"
   git push
