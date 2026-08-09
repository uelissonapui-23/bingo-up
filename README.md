# Bingo PWA

Fundação técnica do sistema de bingo PWA multi-tenant.

## Requisitos

- Node.js 22.12+
- npm 10+
- Supabase CLI, quando for trabalhar com banco local/remoto
- Conta Supabase e Vercel apenas na etapa de conexão/publicação

## Rodar localmente

```bash
cp .env.example .env.local
npm install
npm run dev
```

O frontend abre em `http://localhost:5173`.

Sem credenciais Supabase, a fundação visual continua abrindo e sinaliza que o backend ainda não foi conectado.

## Validação

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Ou tudo de uma vez:

```bash
npm run check
```

## Supabase

A pasta `supabase/migrations` contém a fundação multi-tenant e RLS inicial.

Quando o projeto remoto for criado:

```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase db push
```

Depois, configure `.env.local` com:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

## Vercel

1. Suba este repositório para o GitHub.
2. Importe o repositório na Vercel.
3. Cadastre as mesmas variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`.
4. O `vercel.json` já contém o fallback necessário para rotas SPA.

## Segurança da fundação

- Multi-tenant por `workspace_id`.
- RLS habilitada desde a primeira migration.
- Funções auxiliares de autorização no banco.
- Nenhuma Service Role ou segredo administrativo no frontend.
- Rota pública futura é separada da área administrativa.
- Auditoria base preparada.

## Módulos

A estrutura de rotas e pastas dos módulos 1 a 14 já existe. As páginas exibidas agora são placeholders deliberados, para evitar implementar funcionalidades parciais antes de cada módulo entrar na sequência oficial.


## Estado atual
Fase 4 concluída: motor de geração em lote, catálogo de jogos únicos, cartelas físicas 1/2/3 em 1, repetição controlada e validação transacional no Supabase. Veja `PHASE_4_REPORT.md`.

## Estado atual
Fase 6 concluída: eventos, configuração e geração de cartelas, impressão e vendas básicas do organizador. O próximo módulo é o motor de sorteio.
