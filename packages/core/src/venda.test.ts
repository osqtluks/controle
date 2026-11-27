import { describe, expect, it } from "vitest";
import { calcularItem, desempenho, potencialDoEstoque } from "./index";

const tabela = { base: 10000, de10: 9500, de30: 8500 }; // R$ 100 / 95 / 85 por grama

describe("item de venda", () => {
  it("escolhe a faixa pela quantidade", () => {
    expect(calcularItem(35, tabela, { kind: "none" })).toMatchObject({ faixa: "base", totalCents: 35000 });
    expect(calcularItem(100, tabela, { kind: "none" })).toMatchObject({ faixa: "de10", totalCents: 95000 });
    expect(calcularItem(300, tabela, { kind: "none" })).toMatchObject({ faixa: "de30", totalCents: 255000 });
  });
  it("aplica desconto sobre o preço da faixa", () => {
    const i = calcularItem(50, tabela, { kind: "percent", bps: 1000 }); // 5 g, 10%
    expect(i).toEqual({ faixa: "base", precoListaPorGrama: 10000, subtotalCents: 50000, descontoCents: 5000, totalCents: 45000 });
    expect(calcularItem(50, tabela, { kind: "perGram", centsPerGram: 9000 }).totalCents).toBe(45000);
    expect(calcularItem(50, tabela, { kind: "fixed", cents: 2000 }).totalCents).toBe(48000);
  });
});

describe("desempenho", () => {
  it("lucro, margem e quanto do investido já voltou", () => {
    expect(desempenho(650000, 390000, 975000)).toEqual({ lucroCents: 260000, margemBps: 4000, recuperadoBps: 6667 });
    expect(desempenho(0, 0, 0)).toEqual({ lucroCents: 0, margemBps: null, recuperadoBps: null });
  });
  it("potencial do estoque restante", () => {
    expect(potencialDoEstoque(1500, tabela)).toEqual({ minCents: 1275000, maxCents: 1500000 });
  });
});

import { descontoGeral, ratear } from "./index";

describe("desconto geral e rateio", () => {
  it("aplica a % sobre a soma", () => {
    expect(descontoGeral(228700, 500)).toBe(11435);
    expect(descontoGeral(1000, 0)).toBe(0);
  });
  it("rateia proporcional e fecha o centavo", () => {
    const r = ratear([231200, 47500], 13935);
    expect(r.reduce((s, v) => s + v, 0)).toBe(13935);
    expect(r).toEqual([11560, 2375]);
    expect(ratear([1, 1, 1], 2)).toEqual([1, 1, 0]);
    expect(ratear([0, 0], 10)).toEqual([0, 0]);
  });
});
