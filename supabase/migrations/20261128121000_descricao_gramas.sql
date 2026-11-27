-- "100,0 g" → "100 g" (mantém "3,5 g") nas descrições de compra.
create or replace function public.fmt_gramas(dg integer)
returns text language sql immutable set search_path = public as $$
  select replace(rtrim(rtrim(to_char(dg / 10.0, 'FM999999990.9'), '0'), '.'), '.', ',') || ' g'
$$;
revoke execute on function public.fmt_gramas(integer) from public, anon;

update public.contas set descricao = regexp_replace(descricao, '(\d+),0 g', '\1 g')
where origem = 'compra' and descricao ~ '\d+,0 g';

create or replace function public.fn_lote_gera_conta()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_prod text;
begin
  if current_setting('app.restaurando', true) = 'on' then return new; end if;
  if new.pagamento = 'prazo' and new.custo_total_cents > 0 then
    select nome into v_prod from produtos where id = new.produto_id;
    perform criar_conta_simples(
      new.owner_id, 'pagar', new.fornecedor_id,
      'Compra de ' || fmt_gramas(new.quantidade_dg) || ' de ' || coalesce(v_prod, 'produto'),
      'compra', null, new.id, new.custo_total_cents, new.vencimento);
  end if;
  return new;
end;
$$;
