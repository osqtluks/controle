-- Exclusão definitiva de produto (a partir da Lixeira).
-- Lotes e movimentos são imutáveis; esta função é o único caminho que pode apagá-los,
-- e só para produtos do próprio usuário. A trava é liberada só dentro da transação.

create or replace function public.fn_somente_acrescentar()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' and current_setting('app.excluindo_produto', true) = 'on' then
    return old;
  end if;
  raise exception '% é só de acrescentar: registre um ajuste em vez de alterar', tg_table_name;
end;
$$;

create or replace function public.fn_lote_so_corrige_fornecedor()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if current_setting('app.excluindo_produto', true) = 'on' then
      return old;
    end if;
    raise exception 'lotes não podem ser apagados: registre um ajuste';
  end if;
  if (to_jsonb(new) - 'fornecedor_id' - 'observacoes') is distinct from (to_jsonb(old) - 'fornecedor_id' - 'observacoes') then
    raise exception 'numa entrada só dá para corrigir fornecedor e observações';
  end if;
  return new;
end;
$$;

-- Retorna o caminho da foto (para o app apagar do Storage).
create or replace function public.excluir_produto_definitivo(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_foto text;
  v_lotes uuid[];
begin
  select foto_path into v_foto from produtos where id = p_id and owner_id = auth.uid();
  if not found then
    raise exception 'produto não encontrado';
  end if;

  select coalesce(array_agg(id), '{}') into v_lotes from lotes where produto_id = p_id;

  perform set_config('app.excluindo_produto', 'on', true);
  delete from movimentos_estoque where produto_id = p_id;
  delete from lotes where produto_id = p_id;
  delete from produtos where id = p_id;
  delete from historico where registro_id = p_id or registro_id = any (v_lotes);
  perform set_config('app.excluindo_produto', 'off', true);

  return v_foto;
end;
$$;

revoke execute on function public.excluir_produto_definitivo(uuid) from public, anon;
grant execute on function public.excluir_produto_definitivo(uuid) to authenticated;
