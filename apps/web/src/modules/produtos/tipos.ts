import type { StockThresholds, TabelaPreco } from "@ct/core";

/** Linha da visão `produtos_estoque`. */
export interface ProdutoEstoque {
  id: string;
  nome: string;
  categoria: string | null;
  descricao: string | null;
  foto_path: string | null;
  preco_cents_por_grama: number;
  custo_ref_cents_por_grama: number | null;
  fornecedor_id: string | null;
  /** Faixas de preço (1 a 6), em ordem: a partir de min_dg, preco_cents por grama. */
  faixas: { min_dg: number; preco_cents: number }[];
  lim_acabou_dg: number;
  lim_muito_baixo_dg: number;
  lim_acabando_dg: number;
  lim_metade_dg: number;
  lim_cheio_dg: number;
  observacoes: string | null;
  arquivado: boolean;
  created_at: string;
  updated_at: string;
  estoque_dg: number;
  custo_estoque_cents: number;
  ultima_entrada: string | null;
  proximo_vencimento: string | null;
}

/** Linha da visão `lotes_saldo`, com o nome do fornecedor. */
export interface LoteSaldo {
  id: string;
  produto_id: string;
  fornecedor_id: string | null;
  data_compra: string;
  quantidade_dg: number;
  custo_total_cents: number;
  pagamento: "avista" | "prazo";
  vencimento: string | null;
  observacoes: string | null;
  created_at: string;
  restante_dg: number;
  restante_custo_cents: number;
  fornecedor: { nome: string } | null;
}

export interface EventoHistorico {
  id: number;
  acao: "criou" | "alterou" | "apagou";
  tabela: string;
  antes: Record<string, unknown> | null;
  depois: Record<string, unknown> | null;
  em: string;
}

export function limitesDe(p: ProdutoEstoque): StockThresholds {
  return {
    acabou: p.lim_acabou_dg,
    muitoBaixo: p.lim_muito_baixo_dg,
    acabando: p.lim_acabando_dg,
    metade: p.lim_metade_dg,
    cheio: p.lim_cheio_dg,
  };
}

export function tabelaDe(p: Pick<ProdutoEstoque, "faixas">): TabelaPreco {
  return (p.faixas ?? []).map((f) => ({ minDg: f.min_dg, precoCents: f.preco_cents }));
}
