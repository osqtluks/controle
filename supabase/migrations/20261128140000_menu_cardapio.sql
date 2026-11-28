-- Menu como cardápio: estilo do card por produto, faixa em destaque, selo,
-- modelos de faixas reutilizáveis e preferências do catálogo.
-- Só ACRESCENTA colunas/tabelas: a versão publicada continua funcionando durante o deploy.

alter table public.produtos
  add column menu_estilo text not null default 'simples' check (menu_estilo in ('simples', 'top', 'premium')),
  add column menu_destaque_dg integer check (menu_destaque_dg is null or menu_destaque_dg > 0),
  add column menu_selo text check (menu_selo is null or char_length(menu_selo) <= 40);

-- A visão usa p.*; recria para expor as colunas novas (mesma definição de antes; tudo numa transação só).
drop view public.produtos_estoque;
create view public.produtos_estoque with (security_invoker = true) as
select
  p.*,
  coalesce(s.estoque_dg, 0)::integer as estoque_dg,
  coalesce(s.custo_estoque_cents, 0)::bigint as custo_estoque_cents,
  s.ultima_entrada,
  (select min(cs.proximo_vencimento) from public.contas_saldo cs
     join public.lotes l on l.id = cs.lote_id
   where l.produto_id = p.id and cs.cancelada_em is null and cs.restante_cents > 0) as proximo_vencimento
from public.produtos p
left join lateral (
  select sum(ls.restante_dg) as estoque_dg, sum(ls.restante_custo_cents) as custo_estoque_cents, max(ls.data_compra) as ultima_entrada
  from public.lotes_saldo ls where ls.produto_id = p.id
) s on true;

-- Modelos de faixas ("Tabela premium"): faixas + preços para aplicar em outros produtos.
create table public.modelos_faixas (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome text not null check (char_length(trim(nome)) between 1 and 40),
  faixas jsonb not null check (jsonb_typeof(faixas) = 'array' and jsonb_array_length(faixas) between 1 and 6),
  created_at timestamptz not null default now()
);
alter table public.modelos_faixas enable row level security;
create policy dono on public.modelos_faixas for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
grant select, insert, delete on public.modelos_faixas to authenticated;

-- Preferências (uma linha por usuário). menu = { titulo, subtitulo, mostrar_estoque }.
create table public.preferencias (
  owner_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  menu jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.preferencias enable row level security;
create policy dono on public.preferencias for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
grant select, insert, update on public.preferencias to authenticated;

grant select on public.produtos_estoque to authenticated;
