-- Toda exclusão vira um registro em `exclusoes`, com cópia completa quando é definitiva,
-- e pode ser revertida ("voltar a esse estado").

create table public.exclusoes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tipo text not null check (tipo in ('lixeira', 'definitiva')),
  entidade text not null default 'produto' check (entidade in ('produto')),
  registro_id uuid not null,
  nome text not null,
  resumo jsonb not null default '{}'::jsonb, -- ex.: { "entradas": 3, "estoque_dg": 250 }
  copia jsonb, -- tudo que foi apagado (só na definitiva)
  em timestamptz not null default now(),
  restaurado_em timestamptz
);
create index exclusoes_owner_idx on public.exclusoes (owner_id, em desc);

alter table public.exclusoes enable row level security;
create policy dono on public.exclusoes for select to authenticated using (owner_id = (select auth.uid()));
grant select on public.exclusoes to authenticated;
-- Escrita só pelas funções abaixo.

-- ── Triggers respeitam a restauração (não duplicam movimento nem histórico) ──
create or replace function public.fn_lote_gera_entrada()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if current_setting('app.restaurando', true) = 'on' then
    return new;
  end if;
  insert into movimentos_estoque (owner_id, produto_id, lote_id, tipo, quantidade_dg, custo_cents)
  values (new.owner_id, new.produto_id, new.id, 'entrada', new.quantidade_dg, new.custo_total_cents);
  return new;
end;
$$;

create or replace function public.fn_registrar_historico()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if current_setting('app.restaurando', true) = 'on' then
    return coalesce(new, old);
  end if;
  if tg_op = 'INSERT' then
    insert into historico (owner_id, tabela, registro_id, acao, depois)
    values (new.owner_id, tg_table_name, new.id, 'criou', to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    if to_jsonb(new) - 'updated_at' is distinct from to_jsonb(old) - 'updated_at' then
      insert into historico (owner_id, tabela, registro_id, acao, antes, depois)
      values (new.owner_id, tg_table_name, new.id, 'alterou', to_jsonb(old), to_jsonb(new));
    end if;
    return new;
  else
    insert into historico (owner_id, tabela, registro_id, acao, antes)
    values (old.owner_id, tg_table_name, old.id, 'apagou', to_jsonb(old));
    return old;
  end if;
end;
$$;

-- ── Lixeira (exclusão leve) ──
create or replace function public.definir_lixeira(p_id uuid, p_na_lixeira boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_nome text;
  v_exclusao uuid;
begin
  select nome into v_nome from produtos where id = p_id and owner_id = auth.uid();
  if not found then raise exception 'produto não encontrado'; end if;

  update produtos set arquivado = p_na_lixeira where id = p_id;

  if p_na_lixeira then
    insert into exclusoes (owner_id, tipo, registro_id, nome)
    values (auth.uid(), 'lixeira', p_id, v_nome)
    returning id into v_exclusao;
  else
    update exclusoes set restaurado_em = now()
    where registro_id = p_id and tipo = 'lixeira' and restaurado_em is null and owner_id = auth.uid();
  end if;
  return v_exclusao;
end;
$$;

-- ── Exclusão definitiva: guarda cópia e apaga (retorna o id da exclusão) ──
drop function public.excluir_produto_definitivo(uuid);
create function public.excluir_produto_definitivo(p_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_prod produtos;
  v_lotes uuid[];
  v_copia jsonb;
  v_exclusao uuid;
begin
  select * into v_prod from produtos where id = p_id and owner_id = auth.uid();
  if not found then raise exception 'produto não encontrado'; end if;

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

  -- Exclusão "na lixeira" anterior deste produto fica superada pela definitiva.
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

-- ── Voltar a esse estado ──
create or replace function public.restaurar_exclusao(p_exclusao uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  e exclusoes;
  v_prod produtos;
begin
  select * into e from exclusoes where id = p_exclusao and owner_id = auth.uid();
  if not found then raise exception 'exclusão não encontrada'; end if;
  if e.restaurado_em is not null then raise exception 'isso já foi restaurado'; end if;

  if e.tipo = 'lixeira' then
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
    -- Volta ativo e sem fornecedor que não exista mais.
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

revoke execute on function
  public.definir_lixeira(uuid, boolean),
  public.excluir_produto_definitivo(uuid),
  public.restaurar_exclusao(uuid)
from public, anon;
grant execute on function
  public.definir_lixeira(uuid, boolean),
  public.excluir_produto_definitivo(uuid),
  public.restaurar_exclusao(uuid)
to authenticated;
