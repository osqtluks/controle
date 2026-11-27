import { describe, expect, it } from "vitest";
import { consumirFifo, custoPorGrama, margemBps, ordenar } from "./index";

describe("custo", () => {
  it("custo por grama", () => {
    expect(custoPorGrama(10000, 70)).toBe(1429); // R$ 100 por 7 g
    expect(custoPorGrama(500, 0)).toBeNull();
  });
  it("margem", () => {
    expect(margemBps(1200, 900)).toBe(2500);
    expect(margemBps(0, 900)).toBeNull();
  });
});

describe("FIFO", () => {
  const lotes = [
    { loteId: "a", restanteDg: 30, restanteCustoCents: 1000 },
    { loteId: "b", restanteDg: 70, restanteCustoCents: 3000 },
  ];
  it("consome o mais antigo primeiro e atravessa lotes", () => {
    expect(consumirFifo(lotes, 50)).toEqual([
      { loteId: "a", dg: 30, custoCents: 1000 },
      { loteId: "b", dg: 20, custoCents: 857 },
    ]);
  });
  it("zerar todos os lotes leva o custo exato", () => {
    const c = consumirFifo(lotes, 100);
    expect(c.reduce((s, x) => s + x.custoCents, 0)).toBe(4000);
  });
  it("recusa estoque insuficiente", () => {
    expect(() => consumirFifo(lotes, 101)).toThrow("estoque insuficiente");
  });
});

describe("ordenar", () => {
  const xs = [{ n: "bia", v: 3 }, { n: "Ana", v: null }, { n: "Caio", v: 10 }];
  it("ordena texto sem diferenciar maiúscula e deixa vazios no fim", () => {
    expect(ordenar(xs, (x) => x.n, "asc").map((x) => x.n)).toEqual(["Ana", "bia", "Caio"]);
    expect(ordenar(xs, (x) => x.v, "desc").map((x) => x.n)).toEqual(["Caio", "bia", "Ana"]);
    expect(ordenar(xs, (x) => x.v, "asc").map((x) => x.n)).toEqual(["bia", "Caio", "Ana"]);
  });
});

import { faixaPara, precoPorGramaPara, validarFaixas } from "./index";

describe("faixas de preço por produto", () => {
  const t = [
    { minDg: 50, precoCents: 9000 },
    { minDg: 100, precoCents: 8500 },
    { minDg: 200, precoCents: 8000 },
    { minDg: 500, precoCents: 7000 },
  ]; // 5 · 10 · 20 · 50 g
  it("escolhe a maior faixa que cabe; abaixo de todas, a primeira", () => {
    expect(faixaPara(30, t).minDg).toBe(50);
    expect(faixaPara(150, t).minDg).toBe(100);
    expect(faixaPara(200, t).minDg).toBe(200);
    expect(precoPorGramaPara(1000, t)).toBe(7000);
  });
  it("não depende da ordem e valida", () => {
    expect(faixaPara(250, [...t].reverse()).minDg).toBe(200);
    expect(validarFaixas(t)).toBeNull();
    expect(validarFaixas([])).not.toBeNull();
    expect(validarFaixas([{ minDg: 30, precoCents: 1 }, { minDg: 30, precoCents: 2 }])).not.toBeNull();
    expect(validarFaixas(Array.from({ length: 7 }, (_, i) => ({ minDg: (i + 1) * 10, precoCents: 1 })))).not.toBeNull();
  });
});
