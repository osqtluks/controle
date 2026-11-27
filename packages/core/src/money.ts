/**
 * Dinheiro é SEMPRE inteiro em centavos (`Cents`). Nunca float, nunca string.
 * Conversões para texto só na borda (tela/relatório).
 */
export type Cents = number;

export function assertCents(v: number, campo = "valor"): Cents {
  if (!Number.isSafeInteger(v)) throw new Error(`${campo} precisa ser inteiro em centavos`);
  return v;
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** 4375 → "R$ 43,75" */
export function formatBRL(cents: Cents): string {
  return brl.format(cents / 100).replace(/ /g, " ");
}

/** "43,75" | "R$ 1.043,75" | "43.75" → 4375. Retorna null se inválido. */
export function parseBRL(texto: string): Cents | null {
  let s = texto.replace(/R\$|\s/g, "");
  if (!s) return null;
  // Com vírgula: ponto é milhar. Sem vírgula: ponto é decimal.
  s = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}
