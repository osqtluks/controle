import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Venda } from "./tipos";

const SELECT =
  "id, numero, cliente_id, data, pagamento, vencimento, observacoes, subtotal_cents, desconto_cents, total_cents, custo_cents, cancelada_em, desconto_geral_tipo, desconto_geral_bps, desconto_geral_cents, cupom_codigo, cliente:pessoas(nome), itens:venda_itens(id, produto_id, quantidade_dg, faixa, preco_lista_cents_por_grama, desconto_tipo, desconto_valor, subtotal_cents, desconto_cents, total_cents, custo_cents, desconto_geral_cents, produto:produtos(nome))";

export async function listarVendas(limite = 1000): Promise<Venda[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("vendas").select(SELECT).order("data", { ascending: false }).limit(limite);
  if (error) throw new Error(`Não foi possível carregar as vendas: ${error.message}`);
  return (data ?? []) as unknown as Venda[];
}

export async function obterVenda(id: string): Promise<Venda | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("vendas").select(SELECT).eq("id", id).maybeSingle();
  if (error) throw new Error(`Não foi possível carregar a venda: ${error.message}`);
  return (data as unknown as Venda) ?? null;
}

/** Vendas não canceladas a partir de uma data (para resumos do Painel). */
export async function totaisDesde(desdeISO: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vendas")
    .select("total_cents, custo_cents, data")
    .is("cancelada_em", null)
    .gte("data", desdeISO);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export interface DesempenhoProduto {
  produto_id: string;
  faturado_cents: number;
  custo_vendido_cents: number;
  vendido_dg: number;
  vendas: number;
  investido_cents: number;
  comprado_dg: number;
}

export async function desempenhoDosProdutos(): Promise<Map<string, DesempenhoProduto>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("produtos_desempenho").select("*");
  if (error) throw new Error(error.message);
  return new Map((data as DesempenhoProduto[]).map((d) => [d.produto_id, d]));
}
