-- Cupons (porcentagem com nome) e desconto geral da venda (cupom ou % direto).
-- O desconto geral é rateado entre os itens para o lucro por produto continuar exato.

create table public.cupons (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  codigo text not null check (codigo ~ '^[A-Z0-9][A-Z0-9_-]{1,29}$'),
  percentual_bps integer not null check (percentual_bps > 0 and percentual_bps <= 10000),
  valido_de date,
  valido_ate date,
  limite_usos integer check (limite_usos is null or limite_usos > 0),
  descricao text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, codigo)
);

alter table public.cupons enable row level security;
create policy dono on public.cupons for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
grant select, insert, update on public.cupons to authenticated;

create trigger cupons_updated before update on public.cupons
  for each row execute function public.fn_tocar_updated_at();
create trigger cupons_historico after insert or update or delete on public.cupons
  for each row execute function public.fn_registrar_historico();

alter table public.vendas
  add column desconto_geral_tipo text not null default 'none' check (desconto_geral_tipo in ('none', 'cupom', 'percent')),
  add column desconto_geral_bps integer not null default 0 check (desconto_geral_bps between 0 and 10000),
  add column desconto_geral_cents bigint not null default 0 check (desconto_geral_cents >= 0),
  add column cupom_id uuid references public.cupons(id) on delete set null,
  add column cupom_codigo text;

-- Parte do desconto geral que coube a cada item (rateio proporcional).
alter table public.venda_itens
  add column desconto_geral_cents bigint not null default 0 check (desconto_geral_cents >= 0);

-- Usos de cada cupom (vendas não canceladas).
create view public.cupons_uso with (security_invoker = true) as
select c.*, coalesce(u.usos, 0)::integer as usos, u.ultimo_uso
from public.cupons c
left join lateral (
  select count(*) usos, max(v.data) ultimo_uso from public.vendas v
  where v.cupom_id = c.id and v.cancelada_em is null
) u on true;
grant select on public.cupons_uso to authenticated;

-- ── registrar_venda: agora com desconto geral ──
-- p.desconto_geral = { tipo: 'none'|'cupom'|'percent', bps, cupom_id }
-- cada item traz desconto_geral_cents (rateio calculado pelo app e conferido aqui).
create or replace function public.registrar_venda(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_venda uuid;
  v_item jsonb;
  v_item_id uuid;
  v_falta integer;
  v_custo_item bigint;
  v_lote record;
  v_tira integer;
  v_custo bigint;
  v_nome text;
  v_tem integer;
  v_tipo text := coalesce(p -> 'desconto_geral' ->> 'tipo', 'none');
  v_bps integer := coalesce((p -> 'desconto_geral' ->> 'bps')::integer, 0);
  v_cupom cupons;
  v_usos integer;
  v_soma bigint;
  v_rateio bigint;
begin
  if v_uid is null then raise exception 'sessão expirada'; end if;
  if jsonb_array_length(coalesce(p -> 'itens', '[]')) = 0 then raise exception 'a venda não tem itens'; end if;
  if p ->> 'pagamento' not in ('pago', 'fiado') then raise exception 'forma de pagamento inválida'; end if;
  if p ->> 'cliente_id' is not null
     and not exists (select 1 from pessoas where id = (p ->> 'cliente_id')::uuid and owner_id = v_uid) then
    raise exception 'cliente não encontrado';
  end if;

  -- Desconto geral
  if v_tipo = 'cupom' then
    select * into v_cupom from cupons where id = (p -> 'desconto_geral' ->> 'cupom_id')::uuid and owner_id = v_uid for update;
    if not found or not v_cupom.ativo then raise exception 'cupom inválido ou desativado'; end if;
    if v_cupom.valido_de is not null and current_date < v_cupom.valido_de then raise exception 'cupom % ainda não começou', v_cupom.codigo; end if;
    if v_cupom.valido_ate is not null and current_date > v_cupom.valido_ate then raise exception 'cupom % venceu', v_cupom.codigo; end if;
    if v_cupom.limite_usos is not null then
      select count(*) into v_usos from vendas where cupom_id = v_cupom.id and cancelada_em is null;
      if v_usos >= v_cupom.limite_usos then raise exception 'cupom % já atingiu o limite de % uso(s)', v_cupom.codigo, v_cupom.limite_usos; end if;
    end if;
    v_bps := v_cupom.percentual_bps;
  elsif v_tipo = 'percent' then
    if v_bps <= 0 or v_bps > 10000 then raise exception 'desconto geral inválido'; end if;
  else
    v_tipo := 'none';
    v_bps := 0;
  end if;

  insert into vendas (owner_id, cliente_id, data, pagamento, vencimento, observacoes,
                      subtotal_cents, desconto_cents, total_cents, custo_cents,
                      desconto_geral_tipo, desconto_geral_bps, cupom_id, cupom_codigo)
  values (
    v_uid, nullif(p ->> 'cliente_id', '')::uuid, coalesce((p ->> 'data')::timestamptz, now()),
    p ->> 'pagamento',
    case when p ->> 'pagamento' = 'fiado' then nullif(p ->> 'vencimento', '')::date end,
    nullif(p ->> 'observacoes', ''), 0, 0, 0, 0,
    v_tipo, v_bps, v_cupom.id, v_cupom.codigo
  )
  returning id into v_venda;

  for v_item in select * from jsonb_array_elements(p -> 'itens') loop
    select nome into v_nome from produtos
    where id = (v_item ->> 'produto_id')::uuid and owner_id = v_uid and not arquivado;
    if not found then raise exception 'produto não encontrado ou na Lixeira'; end if;

    perform 1 from lotes where produto_id = (v_item ->> 'produto_id')::uuid for update;

    insert into venda_itens (owner_id, venda_id, produto_id, quantidade_dg, faixa, preco_lista_cents_por_grama,
                             desconto_tipo, desconto_valor, subtotal_cents, desconto_cents, total_cents, desconto_geral_cents)
    values (
      v_uid, v_venda, (v_item ->> 'produto_id')::uuid, (v_item ->> 'quantidade_dg')::integer, v_item ->> 'faixa',
      (v_item ->> 'preco_lista_cents_por_grama')::bigint, coalesce(v_item ->> 'desconto_tipo', 'none'),
      coalesce((v_item ->> 'desconto_valor')::bigint, 0), (v_item ->> 'subtotal_cents')::bigint,
      (v_item ->> 'desconto_cents')::bigint, (v_item ->> 'total_cents')::bigint,
      coalesce((v_item ->> 'desconto_geral_cents')::bigint, 0)
    )
    returning id into v_item_id;

    select coalesce(sum(restante_dg), 0) into v_tem from lotes_saldo where produto_id = (v_item ->> 'produto_id')::uuid;
    if v_tem < (v_item ->> 'quantidade_dg')::integer then
      raise exception 'estoque insuficiente de "%": tem só % g', v_nome, replace(trim(to_char(v_tem / 10.0, 'FM999999990.0')), '.', ',');
    end if;

    v_falta := (v_item ->> 'quantidade_dg')::integer;
    v_custo_item := 0;
    for v_lote in
      select id, restante_dg, restante_custo_cents from lotes_saldo
      where produto_id = (v_item ->> 'produto_id')::uuid and restante_dg > 0
      order by data_compra, created_at
    loop
      exit when v_falta = 0;
      v_tira := least(v_falta, v_lote.restante_dg);
      v_custo := case when v_tira = v_lote.restante_dg then v_lote.restante_custo_cents
                      else round(v_lote.restante_custo_cents::numeric * v_tira / v_lote.restante_dg)::bigint end;
      insert into movimentos_estoque (owner_id, produto_id, lote_id, tipo, quantidade_dg, custo_cents, venda_id)
      values (v_uid, (v_item ->> 'produto_id')::uuid, v_lote.id, 'saida', -v_tira, -v_custo, v_venda);
      v_falta := v_falta - v_tira;
      v_custo_item := v_custo_item + v_custo;
    end loop;
    if v_falta > 0 then raise exception 'estoque insuficiente de "%"', v_nome; end if;

    update venda_itens set custo_cents = v_custo_item where id = v_item_id;
  end loop;

  -- Confere o desconto geral: rateio tem que somar a % sobre o total dos itens.
  select sum(total_cents), sum(desconto_geral_cents) into v_soma, v_rateio from venda_itens where venda_id = v_venda;
  if v_rateio <> round(v_soma::numeric * v_bps / 10000) then
    raise exception 'desconto geral não confere (recarregue a página e tente de novo)';
  end if;
  if exists (select 1 from venda_itens where venda_id = v_venda and desconto_geral_cents > total_cents) then
    raise exception 'desconto geral maior que o item';
  end if;

  update vendas v set
    subtotal_cents = s.sub,
    desconto_cents = s.des,
    desconto_geral_cents = s.ger,
    total_cents = s.tot,
    custo_cents = s.cus
  from (
    select sum(subtotal_cents) sub, sum(desconto_cents + desconto_geral_cents) des, sum(desconto_geral_cents) ger,
           sum(total_cents - desconto_geral_cents) tot, sum(custo_cents) cus
    from venda_itens where venda_id = v_venda
  ) s
  where v.id = v_venda;

  return v_venda;
end;
$$;

-- Desempenho: faturado já descontando a parte do cupom/desconto geral de cada item.
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
  select sum(i.total_cents - i.desconto_geral_cents) faturado_cents, sum(i.custo_cents) custo_vendido_cents,
         sum(i.quantidade_dg) vendido_dg, count(distinct i.venda_id) vendas
  from public.venda_itens i join public.vendas vv on vv.id = i.venda_id
  where i.produto_id = p.id and vv.cancelada_em is null
) v on true
left join lateral (
  select sum(l.custo_total_cents) investido_cents, sum(l.quantidade_dg) comprado_dg
  from public.lotes l where l.produto_id = p.id
) c on true;
