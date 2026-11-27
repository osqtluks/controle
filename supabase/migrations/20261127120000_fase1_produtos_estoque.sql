-- Fase 1: pessoas (básico), produtos, lotes de entrada, movimentos de estoque e histórico.
-- Convenções: dinheiro em centavos (bigint), peso em decigramas (integer, 1 dg = 0,1 g).
-- Todo registro pertence ao dono (owner_id = auth.uid()); RLS em tudo; grants explícitos.

-- ───────────────────────── histórico genérico ─────────────────────────
create table public.historico (
  id bigint generated always as identity primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tabela text not null,
  registro_id uuid not null,
  acao text not null check (acao in ('criou', 'alterou', 'apagou')),
  antes jsonb,
  depois jsonb,
  em timestamptz not null default now()
);
create index historico_registro_idx on public.historico (registro_id, em desc);

create or replace function public.fn_registrar_historico()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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

create or replace function public.fn_tocar_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ───────────────────────── pessoas ─────────────────────────
create table public.pessoas (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome text not null check (char_length(trim(nome)) between 1 and 120),
  tipo text not null default 'cliente' check (tipo in ('cliente', 'fornecedor', 'ambos')),
  telefone text,
  observacoes text,
  arquivada boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index pessoas_owner_idx on public.pessoas (owner_id, nome);

-- ───────────────────────── produtos ─────────────────────────
create table public.produtos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome text not null check (char_length(trim(nome)) between 1 and 120),
  categoria text,
  descricao text,
  foto_path text,
  preco_cents_por_grama bigint not null check (preco_cents_por_grama >= 0),
  -- 5 limites, em decigramas, estritamente crescentes
  lim_acabou_dg integer not null default 0,
  lim_muito_baixo_dg integer not null,
  lim_acabando_dg integer not null,
  lim_metade_dg integer not null,
  lim_cheio_dg integer not null,
  observacoes text,
  arquivado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint produtos_limites_em_ordem check (
    lim_acabou_dg >= 0
    and lim_acabou_dg < lim_muito_baixo_dg
    and lim_muito_baixo_dg < lim_acabando_dg
    and lim_acabando_dg < lim_metade_dg
    and lim_metade_dg < lim_cheio_dg
  )
);
create index produtos_owner_idx on public.produtos (owner_id, nome);

-- ───────────────────────── lotes (entradas de estoque) ─────────────────────────
-- Uma entrada nunca é editada nem apagada: correção é um movimento de ajuste.
create table public.lotes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  produto_id uuid not null references public.produtos(id) on delete restrict,
  fornecedor_id uuid references public.pessoas(id) on delete restrict,
  data_compra date not null default current_date,
  quantidade_dg integer not null check (quantidade_dg > 0),
  custo_total_cents bigint not null check (custo_total_cents >= 0),
  pagamento text not null check (pagamento in ('avista', 'prazo')),
  vencimento date,
  observacoes text,
  created_at timestamptz not null default now(),
  constraint lotes_prazo_tem_vencimento check (
    (pagamento = 'prazo' and vencimento is not null) or (pagamento = 'avista' and vencimento is null)
  )
);
create index lotes_produto_idx on public.lotes (produto_id, data_compra, created_at);

-- ───────────────────────── movimentos de estoque ─────────────────────────
-- Fonte da verdade do estoque: saldo = soma de quantidade_dg. Só acrescenta.
create table public.movimentos_estoque (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  produto_id uuid not null references public.produtos(id) on delete restrict,
  lote_id uuid not null references public.lotes(id) on delete restrict,
  tipo text not null check (tipo in ('entrada', 'saida', 'ajuste')),
  quantidade_dg integer not null check (quantidade_dg <> 0), -- entrada > 0, saída < 0
  custo_cents bigint not null, -- mesmo sinal da quantidade
  venda_id uuid, -- liga à venda na Fase 3
  motivo text,
  created_at timestamptz not null default now()
);
create index movimentos_produto_idx on public.movimentos_estoque (produto_id, created_at);
create index movimentos_lote_idx on public.movimentos_estoque (lote_id);

-- Toda entrada de lote gera o movimento de entrada correspondente.
create or replace function public.fn_lote_gera_entrada()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into movimentos_estoque (owner_id, produto_id, lote_id, tipo, quantidade_dg, custo_cents)
  values (new.owner_id, new.produto_id, new.id, 'entrada', new.quantidade_dg, new.custo_total_cents);
  return new;
end;
$$;

create trigger lote_gera_entrada after insert on public.lotes
  for each row execute function public.fn_lote_gera_entrada();

-- Bloqueia edição/remoção de lotes e movimentos (só acrescentar).
create or replace function public.fn_somente_acrescentar()
returns trigger language plpgsql as $$
begin
  raise exception '% é só de acrescentar: registre um ajuste em vez de alterar', tg_table_name;
end;
$$;

create trigger lotes_imutaveis before update or delete on public.lotes
  for each row execute function public.fn_somente_acrescentar();
create trigger movimentos_imutaveis before update or delete on public.movimentos_estoque
  for each row execute function public.fn_somente_acrescentar();

-- ───────────────────────── triggers de histórico e updated_at ─────────────────────────
create trigger pessoas_updated before update on public.pessoas
  for each row execute function public.fn_tocar_updated_at();
create trigger produtos_updated before update on public.produtos
  for each row execute function public.fn_tocar_updated_at();

create trigger pessoas_historico after insert or update or delete on public.pessoas
  for each row execute function public.fn_registrar_historico();
create trigger produtos_historico after insert or update or delete on public.produtos
  for each row execute function public.fn_registrar_historico();
create trigger lotes_historico after insert on public.lotes
  for each row execute function public.fn_registrar_historico();

-- ───────────────────────── visões de leitura ─────────────────────────
-- Saldo de cada lote (o que ainda resta dele e quanto custa o que resta).
create view public.lotes_saldo with (security_invoker = true) as
select
  l.*,
  coalesce(sum(m.quantidade_dg), 0)::integer as restante_dg,
  coalesce(sum(m.custo_cents), 0)::bigint as restante_custo_cents
from public.lotes l
left join public.movimentos_estoque m on m.lote_id = l.id
group by l.id;

-- Produto com estoque atual, valor de custo em estoque e próximo vencimento a prazo.
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
    -- Até a Fase 4 (contas) não sabemos se já foi pago; mostramos o próximo a vencer.
    min(ls.vencimento) filter (where ls.pagamento = 'prazo' and ls.vencimento >= current_date) as proximo_vencimento
  from public.lotes_saldo ls
  where ls.produto_id = p.id
) s on true;

-- ───────────────────────── RLS + grants ─────────────────────────
alter table public.historico enable row level security;
alter table public.pessoas enable row level security;
alter table public.produtos enable row level security;
alter table public.lotes enable row level security;
alter table public.movimentos_estoque enable row level security;

create policy dono on public.historico for select to authenticated using (owner_id = (select auth.uid()));
create policy dono on public.pessoas for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy dono on public.produtos for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy dono on public.lotes for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy dono on public.movimentos_estoque for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

grant select on public.historico to authenticated;
grant select, insert, update, delete on public.pessoas, public.produtos to authenticated;
grant select, insert on public.lotes, public.movimentos_estoque to authenticated;
grant select on public.lotes_saldo, public.produtos_estoque to authenticated;

-- ───────────────────────── fotos ─────────────────────────
-- Bucket privado; cada usuário só mexe na própria pasta (<uid>/arquivo).
insert into storage.buckets (id, name, public) values ('produtos', 'produtos', false)
on conflict (id) do nothing;

create policy "produtos: dono le" on storage.objects for select to authenticated
  using (bucket_id = 'produtos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "produtos: dono envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'produtos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "produtos: dono apaga" on storage.objects for delete to authenticated
  using (bucket_id = 'produtos' and (storage.foldername(name))[1] = (select auth.uid())::text);
