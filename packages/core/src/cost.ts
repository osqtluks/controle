import type { Cents } from "./money";
import { DG_POR_GRAMA, type Dg } from "./grams";

/** Custo por grama de um lote/estoque, arredondado ao centavo. 0 g → null. */
export function custoPorGrama(totalCents: Cents, dg: Dg): Cents | null {
  if (dg <= 0) return null;
  return Math.round((totalCents * DG_POR_GRAMA) / dg);
}

/**
 * Margem sobre o preço, em pontos-base (2500 = 25%).
 * Preço R$ 12/g e custo R$ 9/g → 2500. Preço 0 → null.
 */
export function margemBps(precoPorGrama: Cents, custoPorGrama: Cents): number | null {
  if (precoPorGrama <= 0) return null;
  return Math.round(((precoPorGrama - custoPorGrama) * 10000) / precoPorGrama);
}

export function formatBps(bps: number): string {
  return `${(bps / 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

export interface SaldoDeLote {
  loteId: string;
  restanteDg: Dg;
  restanteCustoCents: Cents;
}

export interface Consumo {
  loteId: string;
  dg: Dg;
  custoCents: Cents;
}

/**
 * Tira `dg` do estoque pelos lotes mais antigos primeiro (FIFO), na ordem recebida.
 * O custo de cada pedaço é proporcional ao que resta do lote; quem zera o lote
 * leva o custo restante exato, então nunca sobra centavo perdido por arredondamento.
 */
export function consumirFifo(lotes: SaldoDeLote[], dg: Dg): Consumo[] {
  if (!Number.isSafeInteger(dg) || dg <= 0) throw new Error("quantidade inválida");
  const total = lotes.reduce((s, l) => s + Math.max(0, l.restanteDg), 0);
  if (total < dg) throw new Error("estoque insuficiente");

  const out: Consumo[] = [];
  let falta = dg;
  for (const l of lotes) {
    if (falta === 0) break;
    if (l.restanteDg <= 0) continue;
    const tira = Math.min(falta, l.restanteDg);
    const custo =
      tira === l.restanteDg
        ? l.restanteCustoCents
        : Math.round((l.restanteCustoCents * tira) / l.restanteDg);
    out.push({ loteId: l.loteId, dg: tira, custoCents: custo });
    falta -= tira;
  }
  return out;
}
