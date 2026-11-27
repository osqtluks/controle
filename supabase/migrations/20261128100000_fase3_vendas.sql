-- Fase 3: vendas em gramas, baixa de estoque pelos lotes mais antigos (FIFO),
-- lucro real por venda, cancelamento reversível e desempenho por produto.

create table public.vendas (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  numero bigint generated always as identity,
  cliente_id uuid references public.pessoas(id) on delete set null,
  data timestamptz not null default now(),
  pagamento text not null check (pagamento in ('pago', 'fiado')),
  vencimento date,
  observacoes text,
  subtotal_cents bigint not null check (subtotal_cents >= 0),
  desconto_cents bigint not null check (desconto_cents >= 0),
  total_cents bigint not null check (total_cents >= 0),
  custo_cents bigint not null check (custo_cents >= 0),
  cancelada_em timestamptz,
  created_at timestamptz not null default now()
);
create index vendas_owner_data_idx on public.vendas (owner_id, data desc);
create index vendas_cliente_idx on public.vendas (cliente_id);

create table public.venda_itens (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  venda_id uuid not null references public.vendas(id) on delete cascade,
  produto_id uuid not null references public.produtos(id) on delete restrict,
  quantidade_dg integer not null check (quantidade_dg > 0),
  faixa text not null check (faixa in ('base', 'de10', 'de30')),
  preco_lista_cents_por_grama bigint not null check (preco_lista_cents_por_grama >= 0),
  desconto_tipo text not null default 'none' check (desconto_tipo in ('none', 'percent', 'fixed', 'perGram')),
  desconto_valor bigint not null default 0 check (desconto_valor >= 0),
  subtotal_cents bigint not null check (subtotal_cents >= 0),
  desconto_cents bigint not null check (desconto_cents >= 0),
  total_cents bigint not null check (total_cents >= 0 and total_cents <= subtotal_cents),
  custo_cents bigint not null default 0 check (custo_cents >= 0)
);
create index venda_itens_venda_idx on public.venda_itens (venda_id);
create index venda_itens_produto_idx on public.venda_itens (produto_id);

alter table public.movimentos_estoque
  add constraint movimentos_venda_fk foreign key (venda_id) references public.vendas(id) on delete restrict;

alter table public.vendas enable row level security;
alter table public.venda_itens enable row level security;
create policy dono on public.vendas for select to authenticated using (owner_id = (select auth.uid()));
create policy dono on public.venda_itens for select to authenticated using (owner_id = (select auth.uid()));
grant select on public.vendas, public.venda_itens to authenticated;
-- Escrita só pelas funções abaixo (atômicas).

-- Cancelamento de venda entra no Histórico de exclusões.
alter table public.exclusoes drop constraint exclusoes_tipo_check;
alter table public.exclusoes add constraint exclusoes_tipo_check check (tipo in ('lixeira', 'definitiva', 'cancelada'));
alter table public.exclusoes drop constraint exclusoes_entidade_check;
alter table public.exclusoes add constraint exclusoes_entidade_check check (entidade in ('produto', 'venda'));

-- ── Registrar venda ──
-- Preços/descontos já vêm calculados pelo app (@ct/core). Aqui: valida, baixa o estoque
-- pelos lotes mais antigos e grava o custo real de cada item. Tudo ou nada.
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
begin
  if v_uid is null then raise exception 'sessão expirada'; end if;
  if jsonb_array_length(coalesce(p -> 'itens', '[]')) = 0 then raise exception 'a venda não tem itens'; end if;
  if p ->> 'pagamento' not in ('pago', 'fiado') then raise exception 'forma de pagamento inválida'; end if;
  if p ? 'cliente_id' and p ->> 'cliente_id' is not null
     and not exists (select 1 from pessoas where id = (p ->> 'cliente_id')::uuid and owner_id = v_uid) then
    raise exception 'cliente não encontrado';
  end if;

  insert into vendas (owner_id, cliente_id, data, pagamento, vencimento, observacoes,
                      subtotal_cents, desconto_cents, total_cents, custo_cents)
  values (
    v_uid,
    nullif(p ->> 'cliente_id', '')::uuid,
    coalesce((p ->> 'data')::timestamptz, now()),
    p ->> 'pagamento',
    case when p ->> 'pagamento' = 'fiado' then nullif(p ->> 'vencimento', '')::date end,
    nullif(p ->> 'observacoes', ''),
    0, 0, 0, 0
  )
  returning id into v_venda;

  for v_item in select * from jsonb_array_elements(p -> 'itens') loop
    select nome into v_nome from produtos
    where id = (v_item ->> 'produto_id')::uuid and owner_id = v_uid and not arquivado;
    if not found then raise exception 'produto não encontrado ou na Lixeira'; end if;

    -- Trava os lotes do produto enquanto calcula a baixa.
    perform 1 from lotes where produto_id = (v_item ->> 'produto_id')::uuid for update;

    insert into venda_itens (owner_id, venda_id, produto_id, quantidade_dg, faixa, preco_lista_cents_por_grama,
                             desconto_tipo, desconto_valor, subtotal_cents, desconto_cents, total_cents)
    values (
      v_uid, v_venda, (v_item ->> 'produto_id')::uuid, (v_item ->> 'quantidade_dg')::integer, v_item ->> 'faixa',
      (v_item ->> 'preco_lista_cents_por_grama')::bigint, coalesce(v_item ->> 'desconto_tipo', 'none'),
      coalesce((v_item ->> 'desconto_valor')::bigint, 0), (v_item ->> 'subtotal_cents')::bigint,
      (v_item ->> 'desconto_cents')::bigint, (v_item ->> 'total_cents')::bigint
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

    if v_falta > 0 then
      raise exception 'estoque insuficiente de "%"', v_nome;
    end if;

    update venda_itens set custo_cents = v_custo_item where id = v_item_id;
  end loop;

  update vendas v set
    subtotal_cents = s.sub, desconto_cents = s.des, total_cents = s.tot, custo_cents = s.cus
  from (
    select sum(subtotal_cents) sub, sum(desconto_cents) des, sum(total_cents) tot, sum(custo_cents) cus
    from venda_itens where venda_id = v_venda
  ) s
  where v.id = v_venda;

  return v_venda;
end;
$$;

-- ── Cancelar venda (devolve as gramas aos mesmos lotes) ──
create or replace function public.cancelar_venda(p_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v vendas;
  v_exclusao uuid;
  v_cliente text;
begin
  select * into v from vendas where id = p_id and owner_id = auth.uid();
  if not found then raise exception 'venda não encontrada'; end if;
  if v.cancelada_em is not null then raise exception 'esta venda já está cancelada'; end if;

  insert into movimentos_estoque (owner_id, produto_id, lote_id, tipo, quantidade_dg, custo_cents, venda_id, motivo)
  select owner_id, produto_id, lote_id, 'ajuste', -quantidade_dg, -custo_cents, venda_id, 'cancelamento'
  from movimentos_estoque where venda_id = p_id and tipo = 'saida';

  update vendas set cancelada_em = now() where id = p_id;

  select nome into v_cliente from pessoas where id = v.cliente_id;
  insert into exclusoes (owner_id, tipo, entidade, registro_id, nome, resumo)
  values (auth.uid(), 'cancelada', 'venda', p_id,
          'Venda #' || v.numero || coalesce(' · ' || v_cliente, ''),
          jsonb_build_object('total_cents', v.total_cents))
  returning id into v_exclusao;
  return v_exclusao;
end;
$$;

-- ── Restaurar: agora também desfaz cancelamento de venda ──
create or replace function public.restaurar_venda_cancelada(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  m record;
  v_tem integer;
begin
  if not exists (select 1 from vendas where id = p_id and owner_id = auth.uid() and cancelada_em is not null) then
    raise exception 'venda não está cancelada';
  end if;
  for m in select * from movimentos_estoque where venda_id = p_id and tipo = 'saida' loop
    select restante_dg into v_tem from lotes_saldo where id = m.lote_id;
    if v_tem < -m.quantidade_dg then
      raise exception 'não dá para reativar: o estoque desse lote já foi usado em outra venda';
    end if;
    insert into movimentos_estoque (owner_id, produto_id, lote_id, tipo, quantidade_dg, custo_cents, venda_id, motivo)
    values (m.owner_id, m.produto_id, m.lote_id, 'ajuste', m.quantidade_dg, m.custo_cents, p_id, 'reativação');
  end loop;
  update vendas set cancelada_em = null where id = p_id;
end;
$$;

create or replace function public.restaurar_exclusao(p_exclusao uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  e exclusoes;
  v_prod produtos;
begin
  select * into e from exclusoes where id = p_exclusao and owner_id = auth.uid();
  if not found then raise exception 'exclusão não encontrada'; end if;
  if e.restaurado_em is not null then raise exception 'isso já foi restaurado'; end if;

  if e.tipo = 'cancelada' then
    perform restaurar_venda_cancelada(e.registro_id);
  elsif e.tipo = 'lixeira' then
    if not exists (select 1 from produtos where id = e.registro_id) then
      raise exception 'este produto foi excluído de vez depois; restaure pela exclusão definitiva';
    end if;
    update produtos set arquivado = false where id = e.registro_id;
  else
    if exists (select 1 from produtos where id = e.registro_id) then
      raise exception 'o produto já existe';
    end if;
    perform set_config('app.restaurando', 'on', true);

    v_prod := jsonb_populate_record(null::produtos, e.copia -> 'produto');
    v_prod.arquivado := false;
    if v_prod.fornecedor_id is not null and not exists (select 1 from pessoas where id = v_prod.fornecedor_id) then
      v_prod.fornecedor_id := null;
    end if;
    insert into produtos select v_prod.*;

    insert into lotes
    select (r).* from (
      select jsonb_populate_record(null::lotes, x) as r from jsonb_array_elements(e.copia -> 'lotes') x
    ) s;
    update lotes set fornecedor_id = null
    where produto_id = e.registro_id and fornecedor_id is not null
      and not exists (select 1 from pessoas p where p.id = lotes.fornecedor_id);

    insert into movimentos_estoque
    select (r).* from (
      select jsonb_populate_record(null::movimentos_estoque, x) as r from jsonb_array_elements(e.copia -> 'movimentos') x
    ) s;

    insert into historico (owner_id, tabela, registro_id, acao, antes, depois, em)
    select (x ->> 'owner_id')::uuid, x ->> 'tabela', (x ->> 'registro_id')::uuid, x ->> 'acao',
           x -> 'antes', x -> 'depois', (x ->> 'em')::timestamptz
    from jsonb_array_elements(e.copia -> 'historico') x;

    perform set_config('app.restaurando', 'off', true);
  end if;

  update exclusoes set restaurado_em = now() where id = e.id;
  return e.registro_id;
end;
$$;

-- Produto com vendas não pode ser excluído de vez (as vendas apontam para ele).
create or replace function public.excluir_produto_definitivo(p_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_prod produtos;
  v_lotes uuid[];
  v_copia jsonb;
  v_exclusao uuid;
begin
  select * into v_prod from produtos where id = p_id and owner_id = auth.uid();
  if not found then raise exception 'produto não encontrado'; end if;
  if exists (select 1 from venda_itens where produto_id = p_id) then
    raise exception 'este produto tem vendas registradas; deixe-o na Lixeira para manter o histórico de vendas';
  end if;

  select coalesce(array_agg(id), '{}') into v_lotes from lotes where produto_id = p_id;

  v_copia := jsonb_build_object(
    'produto', to_jsonb(v_prod),
    'lotes', coalesce((select jsonb_agg(to_jsonb(l)) from lotes l where l.produto_id = p_id), '[]'),
    'movimentos', coalesce((select jsonb_agg(to_jsonb(m)) from movimentos_estoque m where m.produto_id = p_id), '[]'),
    'historico', coalesce((select jsonb_agg(to_jsonb(h) - 'id') from historico h where h.registro_id = p_id or h.registro_id = any (v_lotes)), '[]')
  );

  insert into exclusoes (owner_id, tipo, registro_id, nome, resumo, copia)
  values (
    auth.uid(), 'definitiva', p_id, v_prod.nome,
    jsonb_build_object(
      'entradas', cardinality(v_lotes),
      'estoque_dg', coalesce((select sum(quantidade_dg) from movimentos_estoque where produto_id = p_id), 0)
    ),
    v_copia
  )
  returning id into v_exclusao;

  update exclusoes set restaurado_em = now()
  where registro_id = p_id and tipo = 'lixeira' and restaurado_em is null;

  perform set_config('app.excluindo_produto', 'on', true);
  delete from movimentos_estoque where produto_id = p_id;
  delete from lotes where produto_id = p_id;
  delete from produtos where id = p_id;
  delete from historico where registro_id = p_id or registro_id = any (v_lotes);
  perform set_config('app.excluindo_produto', 'off', true);

  return v_exclusao;
end;
$$;

-- ── Desempenho por produto (só vendas não canceladas) ──
create view public.produtos_desempenho with (security_invoker = true) as
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
  where i.produto_id = p.id and vv.cancelada_em is null
) v on true
left join lateral (
  select sum(l.custo_total_cents) investido_cents, sum(l.quantidade_dg) comprado_dg
  from public.lotes l where l.produto_id = p.id
) c on true;
grant select on public.produtos_desempenho to authenticated;

revoke execute on function
  public.registrar_venda(jsonb), public.cancelar_venda(uuid),
  public.restaurar_venda_cancelada(uuid)
from public, anon;
grant execute on function public.registrar_venda(jsonb), public.cancelar_venda(uuid) to authenticated;
revoke execute on function public.restaurar_venda_cancelada(uuid) from authenticated;
