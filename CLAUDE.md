# Controle — regras do projeto

Sistema pessoal (1 usuário) de vendas, estoque, contas a pagar/receber, calendário, finanças e diário de cultivo. PC + celular (PWA), hospedado na nuvem (Vercel + Supabase). Interface e textos em PT-BR.

## Estrutura
- `packages/core` — regras de negócio PURAS (sem React, sem banco). Todo cálculo mora aqui e tem teste.
- `apps/web` — Next.js 16 (App Router, `cacheComponents` ligado) + Tailwind 4. Só tela e acesso a dados.
- `apps/web/src/modules/registry.ts` — lista de módulos (menu, fase, pronto/em breve). Módulo novo entra aqui.
- `apps/web/src/app/[modulo]` — página "em breve" para módulos sem rota própria.

## Regras que não se quebram
- Dinheiro: inteiro em **centavos** (`Cents`). Nunca float.
- Peso: inteiro em **decigramas** (`Dg`, 1 dg = 0,1 g). Preço é **centavos por grama**.
- Lucro = valor recebido − custo real das gramas que saíram (custo vem do lote de entrada).
- Descontos: `percent` (pontos-base), `fixed` (centavos) ou `perGram` (novo preço/grama). Nunca vira acréscimo.
- Lançamentos financeiros e histórico de dívidas são **só de acrescentar**: corrigir = novo registro (estorno/evento), nunca UPDATE/DELETE do passado.
- Vencimento original de parcela é imutável; postergar cria evento e muda só o vencimento atual.
- Módulos não importam telas uns dos outros. Integração entre módulos por eventos/tabelas, regras compartilhadas via `@ct/core`.
- Toda tabela com ordenação completa (valor, atraso, data, nome) — requisito do usuário.

## Comandos (na raiz)
- `npm run dev` — sobe o app
- `npm run check` — typecheck + lint + testes (rodar antes de todo commit)
- `npm test` — só os testes do core

## Fases
Ver `docs/fases.md`. Uma fase por vez; cada fase termina usável e testada.
