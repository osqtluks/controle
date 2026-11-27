-- Faixas de preço personalizadas por produto (1 a 6): [{ "min_dg": 30, "preco_cents": 9000 }, ...]
-- Substitui as 3 faixas fixas (3/10/30 g). preco_cents_por_grama passa a ser sempre o da menor faixa.

alter table public.produtos add column faixas jsonb not null default '[]'::jsonb;

update public.produtos set faixas = (
  select jsonb_agg(jsonb_build_object('min_dg', m, 'preco_cents', pr) order by m)
  from (values (30, preco_cents_por_grama), (100, preco_10g_cents_por_grama), (300, preco_30g_cents_por_grama)) v(m, pr)
  where pr is not null
);

-- Mantém preco_cents_por_grama = preço da menor faixa, e as faixas em ordem.
create or replace function public.fn_produto_faixas()
returns trigger language plpgsql set search_path = public as $$
declare v_n integer;
begin
  if jsonb_typeof(new.faixas) <> 'array' then raise exception 'faixas inválidas'; end if;
  v_n := jsonb_array_length(new.faixas);
  if v_n < 1 or v_n > 6 then raise exception 'o produto precisa de 1 a 6 faixas de preço'; end if;
  new.faixas := (
    select jsonb_agg(jsonb_build_object('min_dg', (f ->> 'min_dg')::integer, 'preco_cents', (f ->> 'preco_cents')::bigint)
                     order by (f ->> 'min_dg')::integer)
    from jsonb_array_elements(new.faixas) f
  );
  if exists (select 1 from jsonb_array_elements(new.faixas) f
             where (f ->> 'min_dg')::integer <= 0 or (f ->> 'preco_cents')::bigint < 0) then
    raise exception 'faixa com quantidade ou preço inválido';
  end if;
  if (select count(distinct f ->> 'min_dg') from jsonb_array_elements(new.faixas) f) <> v_n then
    raise exception 'duas faixas com a mesma quantidade';
  end if;
  new.preco_cents_por_grama := (new.faixas -> 0 ->> 'preco_cents')::bigint;
  return new;
end;
$$;
revoke execute on function public.fn_produto_faixas() from public, anon, authenticated;
create trigger produtos_faixas before insert or update of faixas on public.produtos
  for each row execute function public.fn_produto_faixas();

-- Itens de venda: faixa passa a guardar o "a partir de" em decigramas ("30", "100"...).
alter table public.venda_itens drop constraint venda_itens_faixa_check;
update public.venda_itens set faixa = case faixa when 'base' then '30' when 'de10' then '100' when 'de30' then '300' else faixa end;

-- Tira as colunas antigas (a visão usa p.*; recria).
drop view public.produtos_estoque;
alter table public.produtos drop column preco_10g_cents_por_grama, drop column preco_30g_cents_por_grama;
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
grant select on public.produtos_estoque to authenticated;
