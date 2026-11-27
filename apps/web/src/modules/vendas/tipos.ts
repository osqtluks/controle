import type { Discount } from "@ct/core";
import { parseBRL } from "@ct/core";

export interface Venda {
  id: string;
  numero: number;
  cliente_id: string | null;
  data: string;
  pagamento: "pago" | "fiado";
  vencimento: string | null;
  observacoes: string | null;
  subtotal_cents: number;
  desconto_cents: number;
  total_cents: number;
  custo_cents: number;
  cancelada_em: string | null;
  cliente: { nome: string } | null;
  itens: VendaItem[];
}

export interface VendaItem {
  id: string;
  produto_id: string;
  quantidade_dg: number;
  faixa: "base" | "de10" | "de30";
  preco_lista_cents_por_grama: number;
  desconto_tipo: Discount["kind"];
  desconto_valor: number;
  subtotal_cents: number;
  desconto_cents: number;
  total_cents: number;
  custo_cents: number;
  produto: { nome: string } | null;
}

/** Desconto como o usuário digita na tela. */
export type TipoDesconto = "none" | "percent" | "fixed" | "perGram";
export interface DescontoDigitado {
  tipo: TipoDesconto;
  valor: string;
}

export const ROTULO_DESCONTO: Record<TipoDesconto, string> = {
  none: "Sem desconto",
  percent: "% de desconto",
  fixed: "R$ de desconto",
  perGram: "Novo preço por grama",
};

/** "10" (%) → bps; "5,00" → centavos. Inválido → null. */
export function lerDesconto(d: DescontoDigitado): Discount | null {
  if (d.tipo === "none" || !d.valor.trim()) return { kind: "none" };
  if (d.tipo === "percent") {
    const n = Number(d.valor.replace(",", "."));
    return Number.isFinite(n) && n >= 0 && n <= 100 ? { kind: "percent", bps: Math.round(n * 100) } : null;
  }
  const c = parseBRL(d.valor);
  if (c === null || c < 0) return null;
  return d.tipo === "fixed" ? { kind: "fixed", cents: c } : { kind: "perGram", centsPerGram: c };
}

export function descreverDesconto(tipo: TipoDesconto, valor: number): string {
  if (tipo === "percent") return `${(valor / 100).toLocaleString("pt-BR")}%`;
  if (tipo === "fixed") return `−${(valor / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`;
  if (tipo === "perGram") return `${(valor / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/g`;
  return "";
}

export const ROTULO_FAIXA: Record<VendaItem["faixa"], string> = { base: "3 g+", de10: "10 g+", de30: "30 g+" };
