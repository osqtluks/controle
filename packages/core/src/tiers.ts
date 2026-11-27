import type { Cents } from "./money";
import type { Dg } from "./grams";

/** Tabela de preço por grama conforme a quantidade vendida. */
export interface TabelaPreco {
  base: Cents; // 3 g+ (e qualquer quantidade abaixo de 10 g)
  de10: Cents | null; // 10 g+
  de30: Cents | null; // 30 g+
}

export const FAIXAS = [
  { id: "base", rotulo: "3 g+", minDg: 0, exemploDg: 30 },
  { id: "de10", rotulo: "10 g+", minDg: 100, exemploDg: 100 },
  { id: "de30", rotulo: "30 g+", minDg: 300, exemploDg: 300 },
] as const;

export type FaixaId = (typeof FAIXAS)[number]["id"];

/** Preço por grama efetivo de cada faixa (faixa vazia herda a de baixo). */
export function precosEfetivos(t: TabelaPreco): Record<FaixaId, Cents> {
  const de10 = t.de10 ?? t.base;
  return { base: t.base, de10, de30: t.de30 ?? de10 };
}

/** Qual faixa vale para `dg` decigramas. */
export function faixaPara(dg: Dg): FaixaId {
  if (dg >= 300) return "de30";
  if (dg >= 100) return "de10";
  return "base";
}

/** Preço por grama para vender `dg` decigramas. */
export function precoPorGramaPara(dg: Dg, t: TabelaPreco): Cents {
  return precosEfetivos(t)[faixaPara(dg)];
}
