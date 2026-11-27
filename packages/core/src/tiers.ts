import type { Cents } from "./money";
import { formatGrams, type Dg } from "./grams";

/**
 * Faixas de preço por quantidade, definidas por produto (1 a 6).
 * Cada faixa vale "a partir de" `minDg`; abaixo da primeira, vale a primeira.
 * Ex.: [3 g+ R$ 90, 10 g+ R$ 85, 30 g+ R$ 75].
 */
export interface Faixa {
  minDg: Dg;
  precoCents: Cents;
}

export type TabelaPreco = Faixa[];

export const MAX_FAIXAS = 6;

/** Atalhos de faixas (em gramas). */
export const PRESETS_FAIXAS: number[][] = [
  [3, 10, 30],
  [5, 10, 20, 50],
  [3, 6, 9, 12, 15],
  [3, 9, 15, 21],
];

export function ordenarFaixas(t: TabelaPreco): TabelaPreco {
  return [...t].sort((a, b) => a.minDg - b.minDg);
}

export function validarFaixas(t: TabelaPreco): string | null {
  if (!t.length) return "Cadastre pelo menos uma faixa de preço.";
  if (t.length > MAX_FAIXAS) return `No máximo ${MAX_FAIXAS} faixas.`;
  const o = ordenarFaixas(t);
  for (const f of o) {
    if (!Number.isSafeInteger(f.minDg) || f.minDg <= 0) return "Quantidade da faixa inválida.";
    if (!Number.isSafeInteger(f.precoCents) || f.precoCents < 0) return "Preço da faixa inválido.";
  }
  for (let i = 1; i < o.length; i++)
    if (o[i]!.minDg === o[i - 1]!.minDg) return `Duas faixas a partir de ${formatGrams(o[i]!.minDg)}.`;
  return null;
}

/** Qual faixa vale para `dg` decigramas: a maior "a partir de" que cabe; abaixo de todas, a primeira. */
export function faixaPara(dg: Dg, t: TabelaPreco): Faixa {
  const o = ordenarFaixas(t);
  if (!o.length) throw new Error("produto sem faixas de preço");
  let escolhida = o[0]!;
  for (const f of o) if (dg >= f.minDg) escolhida = f;
  return escolhida;
}

export function precoPorGramaPara(dg: Dg, t: TabelaPreco): Cents {
  return faixaPara(dg, t).precoCents;
}

/** 100 → "10 g+" */
export function rotuloFaixa(minDg: Dg): string {
  return `${formatGrams(minDg)}+`;
}
