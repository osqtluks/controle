-- Preço pago por grama de referência, editável no produto.
-- É o "quanto costumo pagar": pré-preenche a entrada e é atualizado a cada nova entrada.
-- O lucro continua usando o custo REAL do lote de onde as gramas saíram.
alter table public.produtos
  add column custo_ref_cents_por_grama bigint check (custo_ref_cents_por_grama is null or custo_ref_cents_por_grama >= 0);

-- A visão usa p.*; recriar (drop + create) para incluir a coluna nova.
drop view public.produtos_estoque;
create view public.produtos_estoque with (security_invoker = true) as
select
  p.*,
  coalesce(s.estoque_dg, 0)::integer as estoque_dg,
  coalesce(s.custo_estoque_cents, 0)::bigint as custo_estoque_cents,
  s.ultima_entrada,
  s.proximo_vencimento
from public.produtos p
left join lateral (
  select
    sum(ls.restante_dg) as estoque_dg,
    sum(ls.restante_custo_cents) as custo_estoque_cents,
    max(ls.data_compra) as ultima_entrada,
    min(ls.vencimento) filter (where ls.pagamento = 'prazo' and ls.vencimento >= current_date) as proximo_vencimento
  from public.lotes_saldo ls
  where ls.produto_id = p.id
) s on true;

grant select on public.produtos_estoque to authenticated;
