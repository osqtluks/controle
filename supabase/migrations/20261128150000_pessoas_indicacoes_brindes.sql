-- Descrições de produto para o cardápio, cadastro completo de pessoas (endereço, horários,
-- indicação), brindes (saída de estoque sem faturamento) e motivo do desconto geral.
-- Só ACRESCENTA: a versão publicada continua funcionando durante o deploy.

-- ───────── descrições "vitrine" ─────────
-- produtos.descricao (já existe) é a descrição padrão. As vitrines são alternativas só do Menu.
create table public.produto_descricoes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  produto_id uuid not null references public.produtos(id) on delete cascade,
  texto text not null check (char_length(trim(texto)) between 1 and 400),
  created_at timestamptz not null default now()
);
create index produto_descricoes_produto_idx on public.produto_descricoes (produto_id);
alter table public.produto_descricoes enable row level security;
create policy dono on public.produto_descricoes for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
grant select, insert, update, delete on public.produto_descricoes to authenticated;

alter table public.produtos
  add column menu_descricao_id uuid references public.produto_descricoes(id) on delete set null,
  add column menu_sem_descricao boolean not null default false;

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
grant select on public.produtos_estoque to authenticated;

-- ───────── pessoas ─────────
-- horarios_entrega = [{ "dias": [1,2,3], "de": "18:00", "ate": "22:00" }] (0 = domingo)
alter table public.pessoas
  add column apelido text check (apelido is null or char_length(apelido) <= 60),
  add column endereco text check (endereco is null or char_length(endereco) <= 300),
  add column referencia text check (referencia is null or char_length(referencia) <= 200),
  add column horarios_entrega jsonb not null default '[]'::jsonb check (jsonb_typeof(horarios_entrega) = 'array'),
  add column aniversario date,
  add column indicado_por uuid references public.pessoas(id) on delete set null,
  add column indicado_em date,
  add constraint pessoas_nao_indica_a_si check (indicado_por is null or indicado_por <> id);
create index pessoas_indicado_por_idx on public.pessoas (indicado_por);

-- ───────── vendas: brinde e motivo do desconto ─────────
alter table public.vendas
  add column brinde boolean not null default false,
  add column desconto_geral_motivo text check (desconto_geral_motivo is null or char_length(desconto_geral_motivo) <= 120);

-- registrar_venda passa a guardar o motivo do desconto geral (ex.: bônus de indicação).
create or replace function public.registrar_venda(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v uuid;
  vv vendas;
begin
  v := registrar_venda_base(p);
  if nullif(p ->> 'desconto_motivo', '') is not null then
    update vendas set desconto_geral_motivo = left(p ->> 'desconto_motivo', 120) where id = v and desconto_geral_tipo <> 'none';
  end if;
  select * into vv from vendas where id = v;
  if vv.pagamento = 'fiado' and vv.total_cents > 0 then
    perform criar_conta_simples(vv.owner_id, 'receber', vv.cliente_id, 'Venda #' || vv.numero, 'venda', v, null, vv.total_cents, vv.vencimento);
  end if;
  return v;
end;
$$;

-- Brinde: sai do estoque pelos lotes mais antigos, vai para um cliente, valor zero.
-- Fica marcado (brinde = true) e não entra em faturamento, lucro nem desempenho.
-- Cancelar é o mesmo de uma venda (volta para o estoque, aparece no Histórico de exclusões).
create or replace function public.registrar_brinde(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v uuid;
  v_itens jsonb;
begin
  if nullif(p ->> 'cliente_id', '') is null then raise exception 'escolha o cliente do brinde'; end if;
  select jsonb_agg(jsonb_build_object(
    'produto_id', i ->> 'produto_id', 'quantidade_dg', (i ->> 'quantidade_dg')::integer, 'faixa', 'brinde',
    'preco_lista_cents_por_grama', 0, 'desconto_tipo', 'none', 'desconto_valor', 0,
    'subtotal_cents', 0, 'desconto_cents', 0, 'total_cents', 0, 'desconto_geral_cents', 0))
  into v_itens from jsonb_array_elements(coalesce(p -> 'itens', '[]')) i;
  if v_itens is null then raise exception 'escolha o produto do brinde'; end if;
  if exists (select 1 from jsonb_array_elements(v_itens) i where (i ->> 'quantidade_dg')::integer <= 0) then
    raise exception 'quantidade inválida';
  end if;

  v := registrar_venda_base(jsonb_build_object(
    'cliente_id', p ->> 'cliente_id', 'data', p ->> 'data', 'pagamento', 'pago',
    'observacoes', p ->> 'observacoes', 'desconto_geral', jsonb_build_object('tipo', 'none'), 'itens', v_itens));
  update vendas set brinde = true where id = v;
  return v;
end;
$$;
revoke execute on function public.registrar_brinde(jsonb) from public, anon;
grant execute on function public.registrar_brinde(jsonb) to authenticated;

-- Desempenho por produto: brinde não é venda.
create or replace view public.produtos_desempenho with (security_invoker = true) as
select
  p.id as produto_id,
  coalesce(v.faturado_cents, 0)::bigint as faturado_cents,
  coalesce(v.custo_vendido_cents, 0)::bigint as custo_vendido_cents,
  coalesce(v.vendido_dg, 0)::bigint as vendido_dg,
  coalesce(v.vendas, 0)::integer as vendas,
  coalesce(c.investido_cents, 0)::bigint as investido_cents,
  coalesce(c.comprado_dg, 0)::bigint as comprado_dg
from public.produtos p
left join lateral (
  select sum(i.total_cents) faturado_cents, sum(i.custo_cents) custo_vendido_cents,
         sum(i.quantidade_dg) vendido_dg, count(distinct i.venda_id) vendas
  from public.venda_itens i join public.vendas vv on vv.id = i.venda_id
  where i.produto_id = p.id and vv.cancelada_em is null and not vv.brinde
) v on true
left join lateral (
  select sum(l.custo_total_cents) investido_cents, sum(l.quantidade_dg) comprado_dg
  from public.lotes l where l.produto_id = p.id
) c on true;
grant select on public.produtos_desempenho to authenticated;
