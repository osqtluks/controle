import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Conta, EventoConta, Pagamento, Parcela } from "./tipos";

export async function listarContas(): Promise<Conta[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contas_saldo")
    .select("*, pessoa:pessoas(nome)")
    .order("proximo_vencimento", { ascending: true, nullsFirst: false });
  if (error) throw new Error(`Não foi possível carregar as contas: ${error.message}`);
  return (data ?? []) as Conta[];
}

export async function obterConta(id: string) {
  const supabase = await createClient();
  const [c, p, pg, ev] = await Promise.all([
    supabase.from("contas_saldo").select("*, pessoa:pessoas(nome)").eq("id", id).maybeSingle(),
    supabase.from("parcelas_saldo").select("*").eq("conta_id", id).order("numero"),
    supabase.from("pagamentos").select("*").eq("conta_id", id).order("data", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("conta_eventos").select("id, tipo, dados, em").eq("conta_id", id).order("em", { ascending: false }),
  ]);
  for (const r of [c, p, pg, ev]) if (r.error) throw new Error(r.error.message);
  if (!c.data) return null;
  return {
    conta: c.data as Conta,
    parcelas: (p.data ?? []) as Parcela[],
    pagamentos: (pg.data ?? []) as Pagamento[],
    eventos: (ev.data ?? []) as EventoConta[],
  };
}

/** Contas abertas (para o Painel). */
export async function contasAbertas(): Promise<Conta[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contas_saldo")
    .select("*, pessoa:pessoas(nome)")
    .is("cancelada_em", null)
    .gt("restante_cents", 0)
    .order("proximo_vencimento", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Conta[];
}

export async function contaDaVenda(vendaId: string): Promise<Conta | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("contas_saldo").select("*, pessoa:pessoas(nome)").eq("venda_id", vendaId).maybeSingle();
  return (data as Conta) ?? null;
}
