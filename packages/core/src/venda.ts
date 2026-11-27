import type { Cents } from "./money";
import { priceFor, type Dg } from "./grams";
import { priceLine, type Discount } from "./discount";
import { faixaPara, precosEfetivos, type FaixaId, type TabelaPreco } from "./tiers";

export interface ItemCalculado {
  faixa: FaixaId;
  precoListaPorGrama: Cents; // preço da faixa, antes do desconto
  subtotalCents: Cents;
  descontoCents: Cents;
  totalCents: Cents;
}

/** Preço de uma linha da venda: escolhe a faixa pela quantidade e aplica o desconto. */
export function calcularItem(dg: Dg, tabela: TabelaPreco, desconto: Discount): ItemCalculado {
  const faixa = faixaPara(dg);
  const precoListaPorGrama = precosEfetivos(tabela)[faixa];
  const l = priceLine(dg, precoListaPorGrama, desconto);
  return { faixa, precoListaPorGrama, subtotalCents: l.subtotalCents, descontoCents: l.discountCents, totalCents: l.totalCents };
}

/** Desconto no formato gravado no banco: tipo + valor inteiro (bps, centavos ou centavos/g). */
export function descontoParaBanco(d: Discount): { tipo: Discount["kind"]; valor: number } {
  switch (d.kind) {
    case "none":
      return { tipo: "none", valor: 0 };
    case "percent":
      return { tipo: "percent", valor: d.bps };
    case "fixed":
      return { tipo: "fixed", valor: d.cents };
    case "perGram":
      return { tipo: "perGram", valor: d.centsPerGram };
  }
}

export interface Desempenho {
  lucroCents: Cents; // faturado − custo do que foi vendido
  margemBps: number | null; // lucro / faturado
  recuperadoBps: number | null; // faturado / investido (10000 = pagou tudo que comprou)
}

/** Desempenho real de um produto a partir das vendas e compras. */
export function desempenho(faturado: Cents, custoVendido: Cents, investido: Cents): Desempenho {
  const lucroCents = faturado - custoVendido;
  return {
    lucroCents,
    margemBps: faturado > 0 ? Math.round((lucroCents * 10000) / faturado) : null,
    recuperadoBps: investido > 0 ? Math.round((faturado * 10000) / investido) : null,
  };
}

/** Quanto o estoque restante pode render: tudo na faixa mais barata até tudo na mais cara. */
export function potencialDoEstoque(dg: Dg, tabela: TabelaPreco): { minCents: Cents; maxCents: Cents } {
  const p = precosEfetivos(tabela);
  const precos = [p.base, p.de10, p.de30];
  return { minCents: priceFor(dg, Math.min(...precos)), maxCents: priceFor(dg, Math.max(...precos)) };
}
