import type { Cents } from "./money";
import { priceFor, type Dg } from "./grams";
import { priceLine, type Discount } from "./discount";
import { faixaPara, type TabelaPreco } from "./tiers";

export interface ItemCalculado {
  faixaMinDg: Dg; // "a partir de" da faixa aplicada
  precoListaPorGrama: Cents; // preço da faixa, antes do desconto
  subtotalCents: Cents;
  descontoCents: Cents;
  totalCents: Cents;
}

/** Preço de uma linha da venda: escolhe a faixa pela quantidade e aplica o desconto. */
export function calcularItem(dg: Dg, tabela: TabelaPreco, desconto: Discount): ItemCalculado {
  const f = faixaPara(dg, tabela);
  const precoListaPorGrama = f.precoCents;
  const l = priceLine(dg, precoListaPorGrama, desconto);
  return { faixaMinDg: f.minDg, precoListaPorGrama, subtotalCents: l.subtotalCents, descontoCents: l.discountCents, totalCents: l.totalCents };
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
  const precos = tabela.map((f) => f.precoCents);
  return { minCents: priceFor(dg, Math.min(...precos)), maxCents: priceFor(dg, Math.max(...precos)) };
}

/** Desconto geral (cupom ou % da venda) sobre a soma dos itens já com seus descontos. */
export function descontoGeral(somaItens: Cents, bps: number): Cents {
  if (bps <= 0) return 0;
  return Math.min(somaItens, Math.round((somaItens * Math.min(bps, 10000)) / 10000));
}

/**
 * Reparte `total` entre os itens na proporção de cada valor (maior resto recebe o centavo
 * que sobra), para o lucro por produto continuar exato mesmo com cupom.
 */
export function ratear(valores: Cents[], total: Cents): Cents[] {
  const soma = valores.reduce((s, v) => s + v, 0);
  if (soma <= 0 || total <= 0) return valores.map(() => 0);
  const brutos = valores.map((v) => (v * total) / soma);
  const partes = brutos.map(Math.floor);
  let sobra = total - partes.reduce((s, v) => s + v, 0);
  const ordem = brutos.map((b, i) => [b - Math.floor(b), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of ordem) {
    if (sobra <= 0) break;
    partes[i]! += 1;
    sobra -= 1;
  }
  return partes;
}
