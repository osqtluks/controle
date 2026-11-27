-- Fase 4: contas a pagar e a receber.
-- Parcelas com vencimento ORIGINAL imutável e vencimento ATUAL (postergável);
-- pagamentos de qualquer valor alocados da parcela mais antiga para a mais nova;
-- tudo registrado em conta_eventos (histórico); estorno e cancelamento reversíveis.
-- Venda fiada vira conta a receber; compra a prazo vira conta a pagar (automático).

create table public.contas (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  numero bigint generated always as identity,
  tipo text not null check (tipo in ('receber', 'pagar')),
  pessoa_id uuid references public.pessoas(id) on delete set null,
  descricao text not null check (char_length(trim(descricao)) between 1 and 200),
  origem text not null default 'manual' check (origem in ('manual', 'venda', 'compra')),
  venda_id uuid unique references public.vendas(id) on delete set null,
  lote_id uuid unique references public.lotes(id) on delete set null,
  modo text not null check (modo in ('fixas', 'livre')),
  valor_total_cents bigint not null check (valor_total_cents > 0),
  observacoes text,
  created_at timestamptz not null default now(),
  cancelada_em timestamptz
);
create index contas_owner_idx on public.contas (owner_id, tipo);

create table public.parcelas (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  conta_id uuid not null references public.contas(id) on delete cascade,
  numero integer not null check (numero > 0),
  valor_cents bigint not null check (valor_cents > 0),
  vencimento_original date,
  vencimento_atual date,
  created_at timestamptz not null default now(),
  unique (conta_id, numero),
  check ((vencimento_original is null) = (vencimento_atual is null))
);

create table public.pagamentos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  conta_id uuid not null references public.contas(id) on delete cascade,
  valor_cents bigint not null check (valor_cents > 0),
  data date not null,
  forma text not null default 'pix' check (forma in ('pix', 'dinheiro', 'cartao', 'transferencia', 'outro')),
  observacao text,
  created_at timestamptz not null default now(),
  estornado_em timestamptz
);
create index pagamentos_conta_idx on public.pagamentos (conta_id);

create table public.alocacoes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  pagamento_id uuid not null references public.pagamentos(id) on delete cascade,
  parcela_id uuid not null references public.parcelas(id) on delete cascade,
  valor_cents bigint not null check (valor_cents > 0)
);
create index alocacoes_parcela_idx on public.alocacoes (parcela_id);

create table public.conta_eventos (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  conta_id uuid not null references public.contas(id) on delete cascade,
  parcela_id uuid references public.parcelas(id) on delete set null,
  tipo text not null check (tipo in ('criada', 'pagamento', 'estorno', 'pagamento_reativado', 'remarcada', 'data_definida', 'cancelada', 'reativada')),
  dados jsonb not null default '{}'::jsonb,
  em timestamptz not null default now()
);
create index conta_eventos_conta_idx on public.conta_eventos (conta_id, em desc);

-- Vencimento original e valor de parcela nunca mudam.
create or replace function public.fn_parcela_protege()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.valor_cents <> old.valor_cents then raise exception 'valor da parcela não muda'; end if;
  if old.vencimento_original is not null and new.vencimento_original is distinct from old.vencimento_original then
    raise exception 'o vencimento original não muda; use remarcar';
  end if;
  return new;
end;
$$;
create trigger parcelas_protege before update on public.parcelas
  for each row execute function public.fn_parcela_protege();

-- ── Leitura ──
create view public.parcelas_saldo with (security_invoker = true) as
select
  p.*,
  coalesce(a.pago, 0)::bigint as pago_cents,
  (p.valor_cents - coalesce(a.pago, 0))::bigint as restante_cents,
  coalesce(p.vencimento_atual - p.vencimento_original, 0)::integer as dias_remarcados
from public.parcelas p
left join lateral (
  select sum(al.valor_cents) pago
  from public.alocacoes al join public.pagamentos pg on pg.id = al.pagamento_id
  where al.parcela_id = p.id and pg.estornado_em is null
) a on true;

create view public.contas_saldo with (security_invoker = true) as
select
  c.*,
  coalesce(s.pago, 0)::bigint as pago_cents,
  (c.valor_total_cents - coalesce(s.pago, 0))::bigint as restante_cents,
  s.proximo_vencimento,
  s.proximo_vencimento_original,
  coalesce(s.dias_remarcados, 0)::integer as dias_remarcados,
  coalesce(s.parcelas, 0)::integer as parcelas,
  coalesce(s.parcelas_pagas, 0)::integer as parcelas_pagas,
  s.ultimo_pagamento
from public.contas c
left join lateral (
  select
    sum(ps.pago_cents) pago,
    min(ps.vencimento_atual) filter (where ps.restante_cents > 0) proximo_vencimento,
    (array_agg(ps.vencimento_original order by ps.vencimento_atual nulls last, ps.numero) filter (where ps.restante_cents > 0))[1] proximo_vencimento_original,
    max(ps.dias_remarcados) filter (where ps.restante_cents > 0) dias_remarcados,
    count(*) parcelas,
    count(*) filter (where ps.restante_cents = 0) parcelas_pagas,
    (select max(pg.data) from public.pagamentos pg where pg.conta_id = c.id and pg.estornado_em is null) ultimo_pagamento
  from public.parcelas_saldo ps where ps.conta_id = c.id
) s on true;

alter table public.contas enable row level security;
alter table public.parcelas enable row level security;
alter table public.pagamentos enable row level security;
alter table public.alocacoes enable row level security;
alter table public.conta_eventos enable row level security;
create policy dono on public.contas for select to authenticated using (owner_id = (select auth.uid()));
create policy dono on public.parcelas for select to authenticated using (owner_id = (select auth.uid()));
create policy dono on public.pagamentos for select to authenticated using (owner_id = (select auth.uid()));
create policy dono on public.alocacoes for select to authenticated using (owner_id = (select auth.uid()));
create policy dono on public.conta_eventos for select to authenticated using (owner_id = (select auth.uid()));
grant select on public.contas, public.parcelas, public.pagamentos, public.alocacoes, public.conta_eventos,
  public.parcelas_saldo, public.contas_saldo to authenticated;

alter table public.exclusoes drop constraint exclusoes_entidade_check;
alter table public.exclusoes add constraint exclusoes_entidade_check check (entidade in ('produto', 'venda', 'conta'));

-- ── Criação ──
-- Uso interno (vendas fiadas, compras a prazo, backfill): 1 parcela, modo livre.
create or replace function public.criar_conta_simples(
  p_owner uuid, p_tipo text, p_pessoa uuid, p_descricao text, p_origem text,
  p_venda uuid, p_lote uuid, p_valor bigint, p_vencimento date
) returns uuid language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  insert into contas (owner_id, tipo, pessoa_id, descricao, origem, venda_id, lote_id, modo, valor_total_cents)
  values (p_owner, p_tipo, p_pessoa, p_descricao, p_origem, p_venda, p_lote, 'livre', p_valor)
  returning id into v;
  insert into parcelas (owner_id, conta_id, numero, valor_cents, vencimento_original, vencimento_atual)
  values (p_owner, v, 1, p_valor, p_vencimento, p_vencimento);
  insert into conta_eventos (owner_id, conta_id, tipo, dados)
  values (p_owner, v, 'criada', jsonb_build_object('valor', p_valor, 'parcelas', 1, 'modo', 'livre', 'origem', p_origem));
  return v;
end;
$$;

-- Pelo app: p = { tipo, pessoa_id, descricao, observacoes, modo, parcelas: [{valor_cents, vencimento}] }
create or replace function public.criar_conta(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v uuid;
  v_total bigint;
  x jsonb;
  i integer := 0;
begin
  if v_uid is null then raise exception 'sessão expirada'; end if;
  if p ->> 'tipo' not in ('receber', 'pagar') then raise exception 'tipo inválido'; end if;
  if p ->> 'modo' not in ('fixas', 'livre') then raise exception 'modo inválido'; end if;
  if jsonb_array_length(coalesce(p -> 'parcelas', '[]')) = 0 then raise exception 'sem parcelas'; end if;
  if p ->> 'pessoa_id' is not null and not exists (select 1 from pessoas where id = (p ->> 'pessoa_id')::uuid and owner_id = v_uid) then
    raise exception 'pessoa não encontrada';
  end if;
  select sum((e ->> 'valor_cents')::bigint) into v_total from jsonb_array_elements(p -> 'parcelas') e;
  if v_total is null or v_total <= 0 then raise exception 'valor inválido'; end if;

  insert into contas (owner_id, tipo, pessoa_id, descricao, origem, modo, valor_total_cents, observacoes)
  values (v_uid, p ->> 'tipo', nullif(p ->> 'pessoa_id', '')::uuid, p ->> 'descricao', 'manual', p ->> 'modo', v_total, nullif(p ->> 'observacoes', ''))
  returning id into v;

  for x in select * from jsonb_array_elements(p -> 'parcelas') loop
    i := i + 1;
    if (x ->> 'valor_cents')::bigint <= 0 then raise exception 'parcela % com valor inválido', i; end if;
    insert into parcelas (owner_id, conta_id, numero, valor_cents, vencimento_original, vencimento_atual)
    values (v_uid, v, i, (x ->> 'valor_cents')::bigint, nullif(x ->> 'vencimento', '')::date, nullif(x ->> 'vencimento', '')::date);
  end loop;

  insert into conta_eventos (owner_id, conta_id, tipo, dados)
  values (v_uid, v, 'criada', jsonb_build_object('valor', v_total, 'parcelas', i, 'modo', p ->> 'modo', 'origem', 'manual'));
  return v;
end;
$$;

-- ── Pagamento (baixa de qualquer valor) ──
create or replace function public.registrar_pagamento(p_conta uuid, p_valor bigint, p_data date, p_forma text, p_obs text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  c contas;
  v_pag uuid;
  v_resto bigint := p_valor;
  v_falta bigint;
  r record;
  v_aloc bigint;
  v_lista jsonb := '[]'::jsonb;
begin
  select * into c from contas where id = p_conta and owner_id = auth.uid() for update;
  if not found then raise exception 'conta não encontrada'; end if;
  if c.cancelada_em is not null then raise exception 'conta cancelada'; end if;
  if p_valor is null or p_valor <= 0 then raise exception 'valor inválido'; end if;

  select coalesce(sum(restante_cents), 0) into v_falta from parcelas_saldo where conta_id = p_conta;
  if p_valor > v_falta then
    raise exception 'valor maior que o que falta (falta R$ %)', replace(to_char(v_falta / 100.0, 'FM999999990.00'), '.', ',');
  end if;

  insert into pagamentos (owner_id, conta_id, valor_cents, data, forma, observacao)
  values (c.owner_id, p_conta, p_valor, coalesce(p_data, current_date), coalesce(p_forma, 'pix'), nullif(p_obs, ''))
  returning id into v_pag;

  for r in
    select id, numero, restante_cents from parcelas_saldo
    where conta_id = p_conta and restante_cents > 0
    order by vencimento_atual nulls last, numero
  loop
    exit when v_resto = 0;
    v_aloc := least(v_resto, r.restante_cents);
    insert into alocacoes (owner_id, pagamento_id, parcela_id, valor_cents) values (c.owner_id, v_pag, r.id, v_aloc);
    v_lista := v_lista || jsonb_build_object('parcela', r.numero, 'valor', v_aloc);
    v_resto := v_resto - v_aloc;
  end loop;

  insert into conta_eventos (owner_id, conta_id, tipo, dados)
  values (c.owner_id, p_conta, 'pagamento', jsonb_build_object(
    'pagamento_id', v_pag, 'valor', p_valor, 'data', coalesce(p_data, current_date), 'forma', coalesce(p_forma, 'pix'),
    'obs', p_obs, 'alocacoes', v_lista, 'falta_depois', v_falta - p_valor));
  return v_pag;
end;
$$;

create or replace function public.estornar_pagamento(p_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare pg pagamentos;
begin
  select * into pg from pagamentos where id = p_id and owner_id = auth.uid() for update;
  if not found then raise exception 'pagamento não encontrado'; end if;
  if pg.estornado_em is not null then raise exception 'pagamento já estornado'; end if;
  update pagamentos set estornado_em = now() where id = p_id;
  insert into conta_eventos (owner_id, conta_id, tipo, dados)
  values (pg.owner_id, pg.conta_id, 'estorno', jsonb_build_object('pagamento_id', p_id, 'valor', pg.valor_cents, 'data', pg.data));
  return pg.conta_id;
end;
$$;

create or replace function public.reativar_pagamento(p_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  pg pagamentos;
  a record;
begin
  select * into pg from pagamentos where id = p_id and owner_id = auth.uid() for update;
  if not found then raise exception 'pagamento não encontrado'; end if;
  if pg.estornado_em is null then raise exception 'pagamento não está estornado'; end if;
  for a in select al.valor_cents, ps.restante_cents from alocacoes al join parcelas_saldo ps on ps.id = al.parcela_id where al.pagamento_id = p_id loop
    if a.valor_cents > a.restante_cents then
      raise exception 'não dá para reativar: outro pagamento já cobriu essa parcela';
    end if;
  end loop;
  update pagamentos set estornado_em = null where id = p_id;
  insert into conta_eventos (owner_id, conta_id, tipo, dados)
  values (pg.owner_id, pg.conta_id, 'pagamento_reativado', jsonb_build_object('pagamento_id', p_id, 'valor', pg.valor_cents));
  return pg.conta_id;
end;
$$;

-- ── Remarcar vencimento (postergar ou antecipar) ──
create or replace function public.remarcar_parcela(p_parcela uuid, p_nova date, p_motivo text)
returns uuid language plpgsql security definer set search_path = public as $$
declare pa parcelas;
begin
  select * into pa from parcelas where id = p_parcela and owner_id = auth.uid() for update;
  if not found then raise exception 'parcela não encontrada'; end if;
  if p_nova is null then raise exception 'informe a nova data'; end if;
  if exists (select 1 from contas where id = pa.conta_id and cancelada_em is not null) then raise exception 'conta cancelada'; end if;

  if pa.vencimento_atual is null then
    update parcelas set vencimento_original = p_nova, vencimento_atual = p_nova where id = p_parcela;
    insert into conta_eventos (owner_id, conta_id, parcela_id, tipo, dados)
    values (pa.owner_id, pa.conta_id, p_parcela, 'data_definida', jsonb_build_object('parcela', pa.numero, 'para', p_nova, 'motivo', nullif(p_motivo, '')));
  else
    if p_nova = pa.vencimento_atual then raise exception 'a data é a mesma'; end if;
    update parcelas set vencimento_atual = p_nova where id = p_parcela;
    insert into conta_eventos (owner_id, conta_id, parcela_id, tipo, dados)
    values (pa.owner_id, pa.conta_id, p_parcela, 'remarcada', jsonb_build_object(
      'parcela', pa.numero, 'de', pa.vencimento_atual, 'para', p_nova, 'original', pa.vencimento_original,
      'dias', p_nova - pa.vencimento_atual, 'total_desde_original', p_nova - pa.vencimento_original,
      'motivo', nullif(p_motivo, '')));
  end if;
  return pa.conta_id;
end;
$$;

-- ── Cancelar / reativar conta (vai para o Histórico de exclusões) ──
create or replace function public.cancelar_conta(p_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  c contas_saldo;
  v_pessoa text;
  v_ex uuid;
begin
  select * into c from contas_saldo where id = p_id and owner_id = auth.uid();
  if not found then raise exception 'conta não encontrada'; end if;
  if c.cancelada_em is not null then raise exception 'conta já cancelada'; end if;
  update contas set cancelada_em = now() where id = p_id;
  insert into conta_eventos (owner_id, conta_id, tipo, dados) values (c.owner_id, p_id, 'cancelada', '{}'::jsonb);
  select nome into v_pessoa from pessoas where id = c.pessoa_id;
  insert into exclusoes (owner_id, tipo, entidade, registro_id, nome, resumo)
  values (c.owner_id, 'cancelada', 'conta', p_id,
          'Conta #' || c.numero || ' · ' || c.descricao || coalesce(' · ' || v_pessoa, ''),
          jsonb_build_object('total_cents', c.valor_total_cents, 'restante_cents', c.restante_cents, 'tipo_conta', c.tipo))
  returning id into v_ex;
  return v_ex;
end;
$$;

create or replace function public.reativar_conta(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare c contas;
begin
  select * into c from contas where id = p_id and owner_id = auth.uid();
  if not found or c.cancelada_em is null then raise exception 'conta não está cancelada'; end if;
  update contas set cancelada_em = null where id = p_id;
  insert into conta_eventos (owner_id, conta_id, tipo, dados) values (c.owner_id, p_id, 'reativada', '{}'::jsonb);
end;
$$;

-- ── Integração com vendas: fiado vira conta a receber ──
alter function public.registrar_venda(jsonb) rename to registrar_venda_base;
create function public.registrar_venda(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v uuid;
  vv vendas;
begin
  v := registrar_venda_base(p);
  select * into vv from vendas where id = v;
  if vv.pagamento = 'fiado' and vv.total_cents > 0 then
    perform criar_conta_simples(vv.owner_id, 'receber', vv.cliente_id, 'Venda #' || vv.numero, 'venda', v, null, vv.total_cents, vv.vencimento);
  end if;
  return v;
end;
$$;

alter function public.cancelar_venda(uuid) rename to cancelar_venda_base;
create function public.cancelar_venda(p_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_ex uuid;
begin
  v_ex := cancelar_venda_base(p_id);
  update contas set cancelada_em = now() where venda_id = p_id and cancelada_em is null;
  insert into conta_eventos (owner_id, conta_id, tipo, dados)
  select owner_id, id, 'cancelada', '{"motivo":"venda cancelada"}'::jsonb from contas where venda_id = p_id;
  return v_ex;
end;
$$;

alter function public.restaurar_venda_cancelada(uuid) rename to restaurar_venda_cancelada_base;
create function public.restaurar_venda_cancelada(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform restaurar_venda_cancelada_base(p_id);
  update contas set cancelada_em = null where venda_id = p_id and cancelada_em is not null;
  insert into conta_eventos (owner_id, conta_id, tipo, dados)
  select owner_id, id, 'reativada', '{"motivo":"venda reativada"}'::jsonb from contas where venda_id = p_id;
end;
$$;

-- restaurar_exclusao: cancelamentos de conta também voltam.
create or replace function public.restaurar_exclusao(p_exclusao uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  e exclusoes;
  v_prod produtos;
begin
  select * into e from exclusoes where id = p_exclusao and owner_id = auth.uid();
  if not found then raise exception 'exclusão não encontrada'; end if;
  if e.restaurado_em is not null then raise exception 'isso já foi restaurado'; end if;

  if e.tipo = 'cancelada' and e.entidade = 'conta' then
    perform reativar_conta(e.registro_id);
  elsif e.tipo = 'cancelada' then
    perform restaurar_venda_cancelada(e.registro_id);
  elsif e.tipo = 'lixeira' then
    if not exists (select 1 from produtos where id = e.registro_id) then
      raise exception 'este produto foi excluído de vez depois; restaure pela exclusão definitiva';
    end if;
    update produtos set arquivado = false where id = e.registro_id;
  else
    if exists (select 1 from produtos where id = e.registro_id) then raise exception 'o produto já existe'; end if;
    perform set_config('app.restaurando', 'on', true);
    v_prod := jsonb_populate_record(null::produtos, e.copia -> 'produto');
    v_prod.arquivado := false;
    if v_prod.fornecedor_id is not null and not exists (select 1 from pessoas where id = v_prod.fornecedor_id) then
      v_prod.fornecedor_id := null;
    end if;
    insert into produtos select v_prod.*;
    insert into lotes
    select (r).* from (select jsonb_populate_record(null::lotes, x) as r from jsonb_array_elements(e.copia -> 'lotes') x) s;
    update lotes set fornecedor_id = null
    where produto_id = e.registro_id and fornecedor_id is not null
      and not exists (select 1 from pessoas p where p.id = lotes.fornecedor_id);
    insert into movimentos_estoque
    select (r).* from (select jsonb_populate_record(null::movimentos_estoque, x) as r from jsonb_array_elements(e.copia -> 'movimentos') x) s;
    insert into historico (owner_id, tabela, registro_id, acao, antes, depois, em)
    select (x ->> 'owner_id')::uuid, x ->> 'tabela', (x ->> 'registro_id')::uuid, x ->> 'acao', x -> 'antes', x -> 'depois', (x ->> 'em')::timestamptz
    from jsonb_array_elements(e.copia -> 'historico') x;
    perform set_config('app.restaurando', 'off', true);
  end if;

  update exclusoes set restaurado_em = now() where id = e.id;
  return e.registro_id;
end;
$$;

-- ── Integração com compras: lote a prazo vira conta a pagar ──
create or replace function public.fn_lote_gera_conta()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_prod text;
begin
  if current_setting('app.restaurando', true) = 'on' then return new; end if;
  if new.pagamento = 'prazo' and new.custo_total_cents > 0 then
    select nome into v_prod from produtos where id = new.produto_id;
    perform criar_conta_simples(
      new.owner_id, 'pagar', new.fornecedor_id,
      'Compra de ' || replace(trim(to_char(new.quantidade_dg / 10.0, 'FM999999990.0')), '.', ',') || ' g de ' || coalesce(v_prod, 'produto'),
      'compra', null, new.id, new.custo_total_cents, new.vencimento);
  end if;
  return new;
end;
$$;
create trigger lote_gera_conta after insert on public.lotes
  for each row execute function public.fn_lote_gera_conta();

create or replace function public.fn_lote_fornecedor_na_conta()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.fornecedor_id is distinct from old.fornecedor_id then
    update contas set pessoa_id = new.fornecedor_id where lote_id = new.id;
  end if;
  return new;
end;
$$;
create trigger lote_fornecedor_na_conta after update on public.lotes
  for each row execute function public.fn_lote_fornecedor_na_conta();

-- Selo "pagar em X dias" do produto passa a olhar só o que ainda falta pagar.
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

-- ── Backfill: o que já existe vira conta ──
do $$
declare r record;
begin
  for r in select v.* from vendas v where v.pagamento = 'fiado' and v.total_cents > 0
           and not exists (select 1 from contas c where c.venda_id = v.id) loop
    perform criar_conta_simples(r.owner_id, 'receber', r.cliente_id, 'Venda #' || r.numero, 'venda', r.id, null, r.total_cents, r.vencimento);
    if r.cancelada_em is not null then update contas set cancelada_em = r.cancelada_em where venda_id = r.id; end if;
  end loop;
  for r in select l.*, p.nome produto_nome from lotes l join produtos p on p.id = l.produto_id
           where l.pagamento = 'prazo' and l.custo_total_cents > 0
           and not exists (select 1 from contas c where c.lote_id = l.id) loop
    perform criar_conta_simples(r.owner_id, 'pagar', r.fornecedor_id,
      'Compra de ' || replace(trim(to_char(r.quantidade_dg / 10.0, 'FM999999990.0')), '.', ',') || ' g de ' || r.produto_nome,
      'compra', null, r.id, r.custo_total_cents, r.vencimento);
  end loop;
end;
$$;

-- ── Permissões ──
revoke execute on function
  public.criar_conta_simples(uuid, text, uuid, text, text, uuid, uuid, bigint, date),
  public.registrar_venda_base(jsonb), public.cancelar_venda_base(uuid), public.restaurar_venda_cancelada_base(uuid),
  public.restaurar_venda_cancelada(uuid), public.reativar_conta(uuid),
  public.fn_parcela_protege(), public.fn_lote_gera_conta(), public.fn_lote_fornecedor_na_conta()
from public, anon, authenticated;

revoke execute on function
  public.criar_conta(jsonb), public.registrar_pagamento(uuid, bigint, date, text, text),
  public.estornar_pagamento(uuid), public.reativar_pagamento(uuid), public.remarcar_parcela(uuid, date, text),
  public.cancelar_conta(uuid), public.registrar_venda(jsonb), public.cancelar_venda(uuid)
from public, anon;
grant execute on function
  public.criar_conta(jsonb), public.registrar_pagamento(uuid, bigint, date, text, text),
  public.estornar_pagamento(uuid), public.reativar_pagamento(uuid), public.remarcar_parcela(uuid, date, text),
  public.cancelar_conta(uuid), public.registrar_venda(jsonb), public.cancelar_venda(uuid)
to authenticated;
