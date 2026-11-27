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
- Datas/horas sempre em America/Sao_Paulo via `@/lib/datas` (servidor roda em UTC).
- Histórico de alterações: tabela `historico` (trigger); textos "Você mudou X de A para B" em `modules/produtos/componentes/historico.tsx`.
- Toda exclusão é reversível: aviso "Desfazer" + registro em `exclusoes` (Histórico de exclusões). Seguir em módulos novos.
- Contas: parcelas com vencimento original imutável; remarcar via `remarcar_parcela`; pagamentos alocados da parcela mais antiga; tudo em `conta_eventos`.
- Toda tabela com ordenação completa (valor, atraso, data, nome) — requisito do usuário.

## Banco (Supabase)
- Migrations em `supabase/migrations/`. Nunca editar migration já aplicada: crie outra.
- Toda tabela: `owner_id default auth.uid()`, RLS `owner_id = (select auth.uid())`, `grant` explícito para `authenticated`.
- Visões com `security_invoker = true`. Funções novas sem EXECUTE público (default já revogado).
- Aplicar: `npx supabase db push --remote --yes`. Conferir: `npx supabase db advisors --remote`.
- Leitura no server: `@/lib/supabase/server` (já chama `connection()`); dado de usuário sempre dentro de `<Suspense>`.
- Módulo = `src/modules/<nome>/{tipos.ts, dados.ts (server-only), acoes.ts (server actions), componentes/}`.

## Comandos (na raiz)
- `npm run dev` — sobe o app
- `npm run check` — typecheck + lint + testes + build (rodar antes de todo commit; o build pega erros de pré-render que o resto não pega)
- `npm test` — só os testes do core

## Fases
Ver `docs/fases.md`. Uma fase por vez; cada fase termina usável e testada.
