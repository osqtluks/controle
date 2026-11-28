import { describe, expect, it } from "vitest";
import {
  bonusIndicacao,
  brindeDoMes,
  conquistas,
  inicioDaSemana,
  mensagensPosVenda,
  perfilCliente,
  rankingIndicacoes,
  semanaDoMes,
  type CompraCliente,
} from "./clientes";

const compra = (id: string, data: string, total = 10000, brinde = false): CompraCliente => ({
  id,
  data,
  em: `${data}T10:00:00`,
  totalCents: total,
  brinde,
  itens: [{ produto: "kebab", dg: 30 }],
});

describe("datas", () => {
  it("semana começa na segunda e semana do mês vai de 1 a 4", () => {
    expect(inicioDaSemana("2026-11-28")).toBe("2026-11-23"); // sábado → segunda
    expect(inicioDaSemana("2026-11-23")).toBe("2026-11-23");
    expect(semanaDoMes("2026-11-07")).toBe(1);
    expect(semanaDoMes("2026-11-08")).toBe(2);
    expect(semanaDoMes("2026-11-30")).toBe(4);
  });
});

describe("perfil e brinde", () => {
  const cs = [compra("a", "2026-10-01"), compra("b", "2026-11-02"), compra("c", "2026-11-10"), compra("d", "2026-11-20", 0, true)];
  it("perfil ignora brindes no gasto e calcula intervalo", () => {
    const p = perfilCliente(cs, "2026-11-28");
    expect(p.compras).toBe(3);
    expect(p.gastoCents).toBe(30000);
    expect(p.brindes).toBe(1);
    expect(p.intervaloMedio).toBe(20);
    expect(p.diasSemComprar).toBe(18);
    expect(p.status).toBe("ativo");
    expect(p.comprasNoMes).toBe(2);
  });
  it("brinde na 4ª compra do mês", () => {
    const quatro = [1, 5, 9, 12].map((d, k) => compra(String(k), `2026-11-${String(d).padStart(2, "0")}`));
    expect(brindeDoMes(quatro.slice(0, 3), "2026-11-28")).toMatchObject({ ganhou: false, faltam: 1 });
    expect(brindeDoMes(quatro, "2026-11-28")).toMatchObject({ ganhou: true, entregue: false, faltam: 0 });
  });
});

describe("conquistas", () => {
  it("marca semana, mês, prêmio, retorno e indicação", () => {
    const cs = [
      compra("1", "2026-09-01"),
      compra("2", "2026-11-02"),
      compra("3", "2026-11-03"),
      compra("4", "2026-11-10"),
      compra("5", "2026-11-12"),
    ];
    const t = conquistas(cs, [{ nome: "Ana", data: "2026-11-05" }]).map((c) => c.texto);
    expect(t).toContain("Primeira compra");
    expect(t).toContain("Voltou a comprar depois de 62 dias");
    expect(t).toContain("2ª compra na semana");
    expect(t).toContain("4ª compra no mês");
    expect(t).toContain("Ganhou direito a brinde (4ª compra do mês)");
    expect(t).toContain("5ª compra no total");
    expect(t).toContain("Indicou Ana");
    expect(t[0]).toBe("5ª compra no total"); // mais recente primeiro
  });
});

describe("indicações", () => {
  const pessoas = [
    { id: "A", nome: "Ana", indicadoPor: null },
    { id: "B", nome: "Bia", indicadoPor: null },
    { id: "a1", nome: "a1", indicadoPor: "A" },
    { id: "a2", nome: "a2", indicadoPor: "A" },
    { id: "b1", nome: "b1", indicadoPor: "B" },
  ];
  it("ranking conta só indicados que compraram nos últimos 30 dias", () => {
    const vendas = [
      { clienteId: "a1", data: "2026-11-20" },
      { clienteId: "a2", data: "2026-09-01" },
      { clienteId: "b1", data: "2026-11-25" },
    ];
    const r = rankingIndicacoes(pessoas, vendas, "2026-11-28");
    expect(r.map((l) => [l.nome, l.ativos, l.posicao])).toEqual([
      ["Ana", 1, 1],
      ["Bia", 1, 2],
    ]);
    // Indicado de Ana parado: Bia passa na frente.
    const r2 = rankingIndicacoes(pessoas, [{ clienteId: "b1", data: "2026-11-25" }], "2026-11-28");
    expect(r2[0]!.nome).toBe("Bia");
    expect(r2.find((l) => l.nome === "Ana")!.posicao).toBeNull();
  });
  it("bônus soma posição e semanas seguidas no top 3", () => {
    const vendas = [{ clienteId: "a1", data: "2026-11-01" }, { clienteId: "a1", data: "2026-11-20" }];
    // Dia 23 (4ª semana), no top 1 desde a 1ª semana: 5% + 12%.
    expect(bonusIndicacao("A", pessoas, vendas, "2026-11-23")).toMatchObject({ posicao: 1, semanasSeguidas: 4, totalBps: 1700 });
    // Na 2ª semana: 5% + 7%.
    expect(bonusIndicacao("A", pessoas, vendas, "2026-11-10").totalBps).toBe(1200);
    // Só entrou no ranking na 3ª semana: 1ª semana seguida = 5% + 5%.
    expect(bonusIndicacao("A", pessoas, [{ clienteId: "a1", data: "2026-11-16" }], "2026-11-17")).toMatchObject({
      semanasSeguidas: 1,
      totalBps: 1000,
    });
    expect(bonusIndicacao("B", pessoas, vendas, "2026-11-23").totalBps).toBe(0);
  });
});

describe("mensagens", () => {
  it("avisa brinde na 4ª compra e manda recado para quem indicou", () => {
    const cs = [1, 5, 9, 12].map((d, k) => compra(String(k), `2026-11-${String(d).padStart(2, "0")}`));
    const sem = { posicao: null, semanasSeguidas: 0, posicaoBps: 0, semanaBps: 0, totalBps: 0 };
    const ms = mensagensPosVenda({
      cliente: { nome: "Carlos Silva", telefone: null },
      compras: cs,
      vendaId: "3",
      hoje: "2026-11-12",
      bonusCliente: sem,
      indicador: { nome: "Ana", telefone: "11", bonus: { ...sem, posicao: 1, posicaoBps: 500, semanaBps: 700, totalBps: 1200, semanasSeguidas: 2 } },
    });
    expect(ms[0]!.texto).toContain("4ª compra este mês");
    expect(ms[0]!.texto).toContain("BRINDE");
    expect(ms[1]!.texto).toContain("Carlos, que você indicou");
    expect(ms[1]!.texto).toContain("12%");
  });
});
