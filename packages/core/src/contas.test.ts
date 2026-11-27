import { describe, expect, it } from "vitest";
import { alocarPagamento, descreverPrazo, gerarParcelas, situacaoDe, somarMeses } from "./index";

describe("parcelas", () => {
  it("divide e joga os centavos nas primeiras", () => {
    const p = gerarParcelas(10000, 3, "2026-12-10", "mensal");
    expect(p.map((x) => x.valorCents)).toEqual([3334, 3333, 3333]);
    expect(p.map((x) => x.vencimento)).toEqual(["2026-12-10", "2027-01-10", "2027-02-10"]);
  });
  it("mês curto não pula", () => {
    expect(somarMeses("2027-01-31", 1)).toBe("2027-02-28");
    expect(gerarParcelas(300, 3, "2026-12-01", "semanal").map((x) => x.vencimento)).toEqual(["2026-12-01", "2026-12-08", "2026-12-15"]);
  });
});

describe("baixa de qualquer valor", () => {
  const abertas = [
    { id: "p1", restanteCents: 5000 },
    { id: "p2", restanteCents: 5000 },
    { id: "p3", restanteCents: 5000 },
  ];
  it("pagou a mais: adianta a próxima", () => {
    expect(alocarPagamento(abertas, 7000)).toEqual([
      { parcelaId: "p1", valorCents: 5000 },
      { parcelaId: "p2", valorCents: 2000 },
    ]);
  });
  it("pagou a menos: parcela fica parcial", () => {
    expect(alocarPagamento(abertas, 1500)).toEqual([{ parcelaId: "p1", valorCents: 1500 }]);
  });
  it("não aceita mais que o total", () => {
    expect(() => alocarPagamento(abertas, 15001)).toThrow();
  });
});

describe("situação (cores)", () => {
  const hoje = "2026-12-10";
  it("classifica", () => {
    expect(situacaoDe(100, "2026-12-07", hoje)).toEqual({ situacao: "atrasada", dias: 3 });
    expect(situacaoDe(100, "2026-12-10", hoje)).toEqual({ situacao: "vence_logo", dias: 0 });
    expect(situacaoDe(100, "2026-12-13", hoje)).toEqual({ situacao: "vence_logo", dias: -3 });
    expect(situacaoDe(100, "2026-12-14", hoje)).toEqual({ situacao: "em_dia", dias: -4 });
    expect(situacaoDe(0, "2026-12-01", hoje).situacao).toBe("quitada");
    expect(situacaoDe(100, null, hoje).situacao).toBe("sem_data");
  });
  it("descreve", () => {
    expect(descreverPrazo({ situacao: "atrasada", dias: 1 })).toBe("1 dia atrasada");
    expect(descreverPrazo({ situacao: "vence_logo", dias: -1 })).toBe("vence amanhã");
  });
});
