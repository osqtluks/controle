import type { Dg } from "./grams";

/**
 * Os 5 limites que o usuário define por produto (em decigramas).
 * Precisam ser estritamente crescentes: acabou < muitoBaixo < acabando < metade < cheio.
 */
export interface StockThresholds {
  acabou: Dg;
  muitoBaixo: Dg;
  acabando: Dg;
  metade: Dg;
  cheio: Dg;
}

export type StockLevel = "acabou" | "muito_baixo" | "acabando" | "metade" | "bom" | "cheio";

export const STOCK_LEVEL_LABEL: Record<StockLevel, string> = {
  acabou: "Acabou",
  muito_baixo: "Muito baixo",
  acabando: "Chegando ao fim",
  metade: "Na metade",
  bom: "Bom",
  cheio: "Cheio",
};

/** Níveis que geram aviso de reposição. */
export const NIVEIS_DE_ALERTA: ReadonlySet<StockLevel> = new Set(["acabou", "muito_baixo", "acabando"]);

export function validateThresholds(t: StockThresholds): string | null {
  const ordem = [t.acabou, t.muitoBaixo, t.acabando, t.metade, t.cheio];
  if (ordem.some((v) => !Number.isSafeInteger(v) || v < 0)) return "limites devem ser pesos válidos";
  for (let i = 1; i < ordem.length; i++) {
    if (ordem[i]! <= ordem[i - 1]!)
      return "a ordem deve ser: acabou < muito baixo < chegando ao fim < metade < cheio";
  }
  return null;
}

export function stockLevel(qty: Dg, t: StockThresholds): StockLevel {
  if (qty <= t.acabou) return "acabou";
  if (qty <= t.muitoBaixo) return "muito_baixo";
  if (qty <= t.acabando) return "acabando";
  if (qty <= t.metade) return "metade";
  if (qty < t.cheio) return "bom";
  return "cheio";
}

/** Percentual da "barra de vida" (0–100), relativo ao limite de cheio. */
export function stockPercent(qty: Dg, t: StockThresholds): number {
  if (t.cheio <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((qty / t.cheio) * 100)));
}
