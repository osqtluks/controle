"use server";

import { refresh } from "next/cache";
import { gerarParcelas, parseBRL, type Intervalo } from "@ct/core";
import { createClient } from "@/lib/supabase/server";
import type { Forma } from "./tipos";

export interface NovaConta {
  tipo: "receber" | "pagar";
  pessoa_id: string | null;
  descricao: string;
  observacoes: string;
  valor: string;
  modo: "fixas" | "livre";
  /** livre: vencimento opcional */
  vencimento: string;
  /** fixas */
  parcelas: number;
  primeiro: string;
  intervalo: Intervalo;
  /** fixas com valores/datas ajustados à mão (opcional) */
  ajustadas?: { valor: string; vencimento: string }[];
}

export async function criarConta(n: NovaConta): Promise<{ id: string } | { erro: string }> {
  const total = parseBRL(n.valor);
  if (!total || total <= 0) return { erro: "Valor inválido. Ex.: 350,00" };
  if (!n.descricao.trim()) return { erro: "Escreva uma descrição (ex.: empréstimo, aluguel, venda de...)." };

  let parcelas: { valor_cents: number; vencimento: string | null }[];
  if (n.modo === "livre") {
    parcelas = [{ valor_cents: total, vencimento: n.vencimento || null }];
  } else if (n.ajustadas?.length) {
    parcelas = [];
    for (const [i, a] of n.ajustadas.entries()) {
      const v = parseBRL(a.valor);
      if (!v || v <= 0) return { erro: `Parcela ${i + 1}: valor inválido.` };
      if (!a.vencimento) return { erro: `Parcela ${i + 1}: falta a data.` };
      parcelas.push({ valor_cents: v, vencimento: a.vencimento });
    }
    const soma = parcelas.reduce((s, p) => s + p.valor_cents, 0);
    if (soma !== total) return { erro: "A soma das parcelas não bate com o valor total." };
  } else {
    if (!n.primeiro) return { erro: "Informe a data da primeira parcela." };
    try {
      parcelas = gerarParcelas(total, n.parcelas, n.primeiro, n.intervalo).map((p) => ({
        valor_cents: p.valorCents,
        vencimento: p.vencimento,
      }));
    } catch (e) {
      return { erro: (e as Error).message };
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("criar_conta", {
    p: {
      tipo: n.tipo,
      pessoa_id: n.pessoa_id,
      descricao: n.descricao.trim(),
      observacoes: n.observacoes.trim() || null,
      modo: n.modo,
      parcelas,
    },
  });
  if (error) return { erro: error.message };
  refresh();
  return { id: data as string };
}

export async function registrarPagamento(
  contaId: string,
  valor: string,
  data: string,
  forma: Forma,
  obs: string,
): Promise<{ id: string } | { erro: string }> {
  const v = parseBRL(valor);
  if (!v || v <= 0) return { erro: "Valor inválido." };
  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("registrar_pagamento", {
    p_conta: contaId,
    p_valor: v,
    p_data: data || null,
    p_forma: forma,
    p_obs: obs.trim() || null,
  });
  if (error) return { erro: error.message };
  refresh();
  return { id: id as string };
}

export async function estornarPagamento(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("estornar_pagamento", { p_id: id });
  if (error) throw new Error(error.message);
  refresh();
}

export async function reativarPagamento(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reativar_pagamento", { p_id: id });
  if (error) throw new Error(error.message);
  refresh();
}

export async function remarcarParcela(parcelaId: string, nova: string, motivo: string): Promise<{ ok: true } | { erro: string }> {
  if (!nova) return { erro: "Escolha a nova data." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("remarcar_parcela", { p_parcela: parcelaId, p_nova: nova, p_motivo: motivo.trim() || null });
  if (error) return { erro: error.message };
  refresh();
  return { ok: true };
}

/** Cancela a conta (reversível). Retorna o id da exclusão para "Desfazer". */
export async function cancelarConta(id: string): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancelar_conta", { p_id: id });
  if (error) throw new Error(error.message);
  refresh();
  return data as string;
}

export async function reativarConta(contaId: string) {
  const supabase = await createClient();
  const { data: e } = await supabase
    .from("exclusoes")
    .select("id")
    .eq("registro_id", contaId)
    .eq("entidade", "conta")
    .is("restaurado_em", null)
    .order("em", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!e) throw new Error("Cancelamento não encontrado.");
  const { error } = await supabase.rpc("restaurar_exclusao", { p_exclusao: e.id });
  if (error) throw new Error(error.message);
  refresh();
}
