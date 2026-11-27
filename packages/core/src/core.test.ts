import { describe, expect, it } from "vitest";
import {
  formatBRL,
  formatGrams,
  parseBRL,
  parseGrams,
  priceFor,
  priceLine,
  stockLevel,
  stockPercent,
  validateThresholds,
  type StockThresholds,
} from "./index";

describe("dinheiro", () => {
  it("formata e lê BRL", () => {
    expect(formatBRL(4375)).toBe("R$ 43,75");
    expect(parseBRL("R$ 1.043,75")).toBe(104375);
    expect(parseBRL("43.75")).toBe(4375);
    expect(parseBRL("abc")).toBeNull();
  });
});

describe("gramas", () => {
  it("formata, lê e calcula preço", () => {
    expect(formatGrams(35)).toBe("3,5 g");
    expect(parseGrams("3,5")).toBe(35);
    expect(parseGrams("3,55")).toBeNull();
    expect(priceFor(35, 1250)).toBe(4375); // 3,5 g × R$ 12,50
  });
});

describe("descontos", () => {
  const dg = 35, preco = 1250; // subtotal R$ 43,75
  it("percentual", () => {
    expect(priceLine(dg, preco, { kind: "percent", bps: 1000 })).toEqual({
      subtotalCents: 4375, discountCents: 438, totalCents: 3937,
    });
  });
  it("valor fixo nunca deixa negativo", () => {
    expect(priceLine(dg, preco, { kind: "fixed", cents: 9999 }).totalCents).toBe(0);
  });
  it("novo preço por grama", () => {
    expect(priceLine(dg, preco, { kind: "perGram", centsPerGram: 1000 }).totalCents).toBe(3500);
  });
  it("preço por grama maior que o de lista não vira acréscimo", () => {
    expect(priceLine(dg, preco, { kind: "perGram", centsPerGram: 2000 }).totalCents).toBe(4375);
  });
});

describe("níveis de estoque", () => {
  const t: StockThresholds = { acabou: 0, muitoBaixo: 50, acabando: 100, metade: 250, cheio: 500 };
  it("classifica", () => {
    expect(stockLevel(0, t)).toBe("acabou");
    expect(stockLevel(40, t)).toBe("muito_baixo");
    expect(stockLevel(100, t)).toBe("acabando");
    expect(stockLevel(200, t)).toBe("metade");
    expect(stockLevel(400, t)).toBe("bom");
    expect(stockLevel(600, t)).toBe("cheio");
    expect(stockPercent(250, t)).toBe(50);
    expect(stockPercent(900, t)).toBe(100);
  });
  it("valida a ordem dos limites", () => {
    expect(validateThresholds(t)).toBeNull();
    expect(validateThresholds({ ...t, metade: 90 })).not.toBeNull();
  });
});
