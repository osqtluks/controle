import type { Cents } from "./money";
import { priceFor, type Dg } from "./grams";

/**
 * Os 3 jeitos de dar desconto numa venda:
 * - percent: `bps` em pontos-base (1000 = 10%, 1250 = 12,5%)
 * - fixed:   abate `cents` do total
 * - perGram: troca o preço por grama para `centsPerGram`
 */
export type Discount =
  | { kind: "none" }
  | { kind: "percent"; bps: number }
  | { kind: "fixed"; cents: Cents }
  | { kind: "perGram"; centsPerGram: Cents };

export interface LinePrice {
  subtotalCents: Cents; // preço cheio
  discountCents: Cents; // quanto saiu de desconto (>= 0)
  totalCents: Cents; // o que o cliente paga
}

export function priceLine(dg: Dg, listCentsPerGram: Cents, d: Discount): LinePrice {
  const subtotalCents = priceFor(dg, listCentsPerGram);
  let total: Cents;
  switch (d.kind) {
    case "none":
      total = subtotalCents;
      break;
    case "percent":
      if (d.bps < 0 || d.bps > 10000) throw new Error("desconto % deve estar entre 0 e 100");
      total = subtotalCents - Math.round((subtotalCents * d.bps) / 10000);
      break;
    case "fixed":
      if (d.cents < 0) throw new Error("desconto em valor não pode ser negativo");
      total = subtotalCents - d.cents;
      break;
    case "perGram":
      if (d.centsPerGram < 0) throw new Error("preço por grama não pode ser negativo");
      total = priceFor(dg, d.centsPerGram);
      break;
  }
  total = Math.max(0, Math.min(total, subtotalCents));
  return { subtotalCents, discountCents: subtotalCents - total, totalCents: total };
}
