import type { Cents } from "./money";

/**
 * Peso é SEMPRE inteiro em decigramas (`Dg`): 1 dg = 0,1 g, a precisão do sistema.
 * 3,5 g = 35 dg. Preço é em centavos POR GRAMA.
 */
export type Dg = number;

export const DG_POR_GRAMA = 10;

export function gramsToDg(g: number): Dg {
  return Math.round(g * DG_POR_GRAMA);
}

export function dgToGrams(dg: Dg): number {
  return dg / DG_POR_GRAMA;
}

/** 35 → "3,5 g" ; 120 → "12 g" */
export function formatGrams(dg: Dg): string {
  const g = dgToGrams(dg);
  return `${g.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} g`;
}

/** "3,5" | "3.5" | "3,5g" → 35. Rejeita mais de 1 casa decimal. */
export function parseGrams(texto: string): Dg | null {
  const s = texto.replace(/\s|g$/gi, "").replace(",", ".");
  if (!/^\d+(\.\d)?$/.test(s)) return null;
  return gramsToDg(Number(s));
}

/** Valor de `dg` decigramas a `centsPerGram` centavos/grama, arredondado ao centavo. */
export function priceFor(dg: Dg, centsPerGram: Cents): Cents {
  return Math.round((dg * centsPerGram) / DG_POR_GRAMA);
}
