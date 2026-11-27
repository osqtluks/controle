-- Fornecedor principal do produto (trocável a qualquer hora, sem mexer no estoque)
-- e permissão de corrigir o fornecedor/observações de uma entrada já feita.

alter table public.produtos
  add column fornecedor_id uuid references public.pessoas(id) on delete set null;

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

-- Lotes: quantidade, custo, datas e pagamento continuam imutáveis.
-- Só fornecedor e observações podem ser corrigidos (e isso vai para o histórico).
create or replace function public.fn_lote_so_corrige_fornecedor()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'lotes não podem ser apagados: registre um ajuste';
  end if;
  if (to_jsonb(new) - 'fornecedor_id' - 'observacoes') is distinct from (to_jsonb(old) - 'fornecedor_id' - 'observacoes') then
    raise exception 'numa entrada só dá para corrigir fornecedor e observações';
  end if;
  return new;
end;
$$;
revoke execute on function public.fn_lote_so_corrige_fornecedor() from public, anon, authenticated;

drop trigger lotes_imutaveis on public.lotes;
create trigger lotes_imutaveis before update or delete on public.lotes
  for each row execute function public.fn_lote_so_corrige_fornecedor();

drop trigger lotes_historico on public.lotes;
create trigger lotes_historico after insert or update on public.lotes
  for each row execute function public.fn_registrar_historico();

-- Lotes não têm updated_at; o histórico compara a linha inteira, então funciona igual.
grant update (fornecedor_id, observacoes) on public.lotes to authenticated;
