import "server-only";
import {
  bonusIndicacao,
  brindeDoMes,
  perfilCliente,
  rankingIndicacoes,
  type CompraCliente,
  type PessoaIndicacao,
  type VendaResumo,
} from "@ct/core";
import { FUSO } from "@/lib/datas";
import { createClient } from "@/lib/supabase/server";
import type { ResumoPessoa } from "./componentes/lista-pessoas";
import { CAMPOS_PESSOA, type Pessoa } from "./tipos";

export type { Pessoa };

export async function listarPessoas(filtro?: "fornecedores" | "clientes"): Promise<Pessoa[]> {
  const supabase = await createClient();
  let q = supabase.from("pessoas").select(CAMPOS_PESSOA).eq("arquivada", false).order("nome");
  if (filtro === "fornecedores") q = q.in("tipo", ["fornecedor", "ambos"]);
  if (filtro === "clientes") q = q.in("tipo", ["cliente", "ambos"]);
  const { data, error } = await q;
  if (error) throw new Error(`Não foi possível carregar as pessoas: ${error.message}`);
  return (data ?? []) as Pessoa[];
}

export async function obterPessoa(id: string): Promise<Pessoa | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("pessoas").select(CAMPOS_PESSOA).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Pessoa) ?? null;
}

const diaDe = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: FUSO });

/**
 * Compras (vendas não canceladas, inclusive brindes) agrupadas por cliente.
 * Base de perfil, conquistas, ranking de indicações e mensagens.
 */
export async function comprasPorCliente(clienteId?: string): Promise<Map<string, CompraCliente[]>> {
  const supabase = await createClient();
  let q = supabase
    .from("vendas")
    .select("id, cliente_id, data, total_cents, brinde, itens:venda_itens(quantidade_dg, produto:produtos(nome))")
    .is("cancelada_em", null)
    .not("cliente_id", "is", null)
    .order("data");
  if (clienteId) q = q.eq("cliente_id", clienteId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const m = new Map<string, CompraCliente[]>();
  for (const v of (data ?? []) as unknown as {
    id: string;
    cliente_id: string;
    data: string;
    total_cents: number;
    brinde: boolean;
    itens: { quantidade_dg: number; produto: { nome: string } | null }[];
  }[]) {
    const c: CompraCliente = {
      id: v.id,
      data: diaDe(v.data),
      em: v.data,
      totalCents: v.total_cents,
      brinde: v.brinde,
      itens: v.itens.map((i) => ({ produto: i.produto?.nome ?? "?", dg: i.quantidade_dg })),
    };
    m.set(v.cliente_id, [...(m.get(v.cliente_id) ?? []), c]);
  }
  return m;
}

/** Tudo que o ranking de indicações precisa. */
export async function dadosIndicacoes(): Promise<{
  pessoas: Pessoa[];
  base: PessoaIndicacao[];
  vendas: VendaResumo[];
  compras: Map<string, CompraCliente[]>;
}> {
  const [pessoas, compras] = await Promise.all([listarPessoas(), comprasPorCliente()]);
  const vendas: VendaResumo[] = [];
  for (const [clienteId, cs] of compras) for (const c of cs) if (!c.brinde) vendas.push({ clienteId, data: c.data });
  return {
    pessoas,
    base: pessoas.map((p) => ({ id: p.id, nome: p.nome, indicadoPor: p.indicado_por })),
    vendas,
    compras,
  };
}

/** Cada pessoa com perfil de compras, brinde do mês e situação no ranking de indicações. */
export async function resumosDePessoas(hoje: string): Promise<ResumoPessoa[]> {
  const { pessoas, base, vendas, compras } = await dadosIndicacoes();
  const ranking = new Map(rankingIndicacoes(base, vendas, hoje).map((l) => [l.id, l]));
  const nomes = new Map(pessoas.map((p) => [p.id, p.nome]));
  return pessoas.map((p) => {
    const cs = compras.get(p.id) ?? [];
    const r = ranking.get(p.id);
    return {
      ...p,
      perfil: perfilCliente(cs, hoje),
      brinde: brindeDoMes(cs, hoje),
      posicao: r?.posicao ?? null,
      indicou: r?.indicados.length ?? 0,
      bonusBps: r?.posicao && r.posicao <= 3 ? bonusIndicacao(p.id, base, vendas, hoje).totalBps : 0,
      indicadoPorNome: p.indicado_por ? (nomes.get(p.indicado_por) ?? null) : null,
    };
  });
}
