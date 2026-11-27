"use server";

import { refresh } from "next/cache";
import { calcularItem, descontoGeral, descontoParaBanco, parseGrams, ratear } from "@ct/core";
import { createClient } from "@/lib/supabase/server";
import { lerDesconto, type DescontoDigitado } from "./tipos";

export interface NovaVenda {
  cliente_id: string | null;
  data: string | null; // ISO; vazio = agora
  pagamento: "pago" | "fiado";
  vencimento: string | null;
  observacoes: string;
  itens: { produto_id: string; quantidade: string; desconto: DescontoDigitado }[];
  /** Desconto da venda toda: código de cupom ou % digitada. */
  geral: { modo: "none" } | { modo: "cupom"; codigo: string } | { modo: "percent"; valor: string };
}

export type CupomValido = { id: string; codigo: string; bps: number; restam: number | null };

/** Procura um cupom pelo código e diz se ele vale agora. */
export async function buscarCupom(codigo: string): Promise<CupomValido | { erro: string }> {
  const c = codigo.trim().toUpperCase();
  if (!c) return { erro: "Digite o código." };
  const supabase = await createClient();
  const { data } = await supabase.from("cupons_uso").select("*").eq("codigo", c).maybeSingle();
  if (!data) return { erro: `Cupom ${c} não existe.` };
  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  if (!data.ativo) return { erro: `Cupom ${c} está desativado.` };
  if (data.valido_de && hoje < data.valido_de) return { erro: `Cupom ${c} só vale a partir de ${data.valido_de.split("-").reverse().join("/")}.` };
  if (data.valido_ate && hoje > data.valido_ate) return { erro: `Cupom ${c} venceu.` };
  if (data.limite_usos && data.usos >= data.limite_usos) return { erro: `Cupom ${c} já foi usado ${data.usos}x (limite).` };
  return { id: data.id, codigo: data.codigo, bps: data.percentual_bps, restam: data.limite_usos ? data.limite_usos - data.usos : null };
}

/**
 * Registra a venda. Os preços são recalculados aqui a partir da tabela do produto
 * (nunca confiamos no total vindo da tela); o banco baixa o estoque e calcula o custo real.
 */
export async function registrarVenda(v: NovaVenda): Promise<{ id: string } | { erro: string }> {
  if (!v.itens.length) return { erro: "Adicione pelo menos um produto." };
  const supabase = await createClient();

  const ids = [...new Set(v.itens.map((i) => i.produto_id))];
  const { data: produtos, error: e1 } = await supabase
    .from("produtos")
    .select("id, nome, preco_cents_por_grama, preco_10g_cents_por_grama, preco_30g_cents_por_grama")
    .in("id", ids);
  if (e1) return { erro: e1.message };
  const porId = new Map(produtos.map((p) => [p.id as string, p]));

  const itens = [];
  for (const i of v.itens) {
    const p = porId.get(i.produto_id);
    if (!p) return { erro: "Produto não encontrado." };
    const dg = parseGrams(i.quantidade);
    if (!dg || dg <= 0) return { erro: `Quantidade inválida em "${p.nome}". Ex.: 3,5` };
    const desconto = lerDesconto(i.desconto);
    if (!desconto) return { erro: `Desconto inválido em "${p.nome}".` };
    const c = calcularItem(
      dg,
      { base: p.preco_cents_por_grama, de10: p.preco_10g_cents_por_grama, de30: p.preco_30g_cents_por_grama },
      desconto,
    );
    const d = descontoParaBanco(desconto);
    itens.push({
      produto_id: p.id,
      quantidade_dg: dg,
      faixa: c.faixa,
      preco_lista_cents_por_grama: c.precoListaPorGrama,
      desconto_tipo: d.tipo,
      desconto_valor: d.valor,
      subtotal_cents: c.subtotalCents,
      desconto_cents: c.descontoCents,
      total_cents: c.totalCents,
    });
  }

  // Desconto geral (cupom ou %) rateado entre os itens.
  let geral: { tipo: "none" | "cupom" | "percent"; bps: number; cupom_id?: string } = { tipo: "none", bps: 0 };
  if (v.geral.modo === "cupom") {
    const c = await buscarCupom(v.geral.codigo);
    if ("erro" in c) return { erro: c.erro };
    geral = { tipo: "cupom", bps: c.bps, cupom_id: c.id };
  } else if (v.geral.modo === "percent" && v.geral.valor.trim()) {
    const n = Number(v.geral.valor.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0 || n > 100) return { erro: "Desconto geral inválido (0 a 100%)." };
    geral = { tipo: "percent", bps: Math.round(n * 100) };
  }
  const soma = itens.reduce((s, i) => s + i.total_cents, 0);
  const partes = ratear(itens.map((i) => i.total_cents), descontoGeral(soma, geral.bps));
  const itensComRateio = itens.map((i, k) => ({ ...i, desconto_geral_cents: partes[k] ?? 0 }));

  const { data, error } = await supabase.rpc("registrar_venda", {
    p: {
      cliente_id: v.cliente_id || null,
      data: v.data || null,
      pagamento: v.pagamento,
      vencimento: v.pagamento === "fiado" ? v.vencimento || null : null,
      observacoes: v.observacoes.trim() || null,
      desconto_geral: geral,
      itens: itensComRateio,
    },
  });
  if (error) return { erro: error.message };
  refresh();
  return { id: data as string };
}

/** Cancela a venda (devolve as gramas ao estoque). Retorna o id da exclusão para "Desfazer". */
export async function cancelarVenda(id: string): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancelar_venda", { p_id: id });
  if (error) throw new Error(error.message);
  refresh();
  return data as string;
}

/** Reativa uma venda cancelada (pelo registro dela no Histórico de exclusões). */
export async function reativarVenda(vendaId: string) {
  const supabase = await createClient();
  const { data: e } = await supabase
    .from("exclusoes")
    .select("id")
    .eq("registro_id", vendaId)
    .eq("tipo", "cancelada")
    .is("restaurado_em", null)
    .order("em", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!e) throw new Error("Cancelamento não encontrado.");
  const { error } = await supabase.rpc("restaurar_exclusao", { p_exclusao: e.id });
  if (error) throw new Error(error.message);
  refresh();
}
