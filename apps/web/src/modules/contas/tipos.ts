import type { SituacaoConta } from "@ct/core";

export interface Conta {
  id: string;
  numero: number;
  tipo: "receber" | "pagar";
  pessoa_id: string | null;
  descricao: string;
  origem: "manual" | "venda" | "compra";
  venda_id: string | null;
  lote_id: string | null;
  modo: "fixas" | "livre";
  valor_total_cents: number;
  observacoes: string | null;
  created_at: string;
  cancelada_em: string | null;
  pago_cents: number;
  restante_cents: number;
  proximo_vencimento: string | null;
  proximo_vencimento_original: string | null;
  dias_remarcados: number;
  parcelas: number;
  parcelas_pagas: number;
  ultimo_pagamento: string | null;
  pessoa: { nome: string } | null;
}

export interface Parcela {
  id: string;
  numero: number;
  valor_cents: number;
  vencimento_original: string | null;
  vencimento_atual: string | null;
  pago_cents: number;
  restante_cents: number;
  dias_remarcados: number;
}

export interface Pagamento {
  id: string;
  valor_cents: number;
  data: string;
  forma: Forma;
  observacao: string | null;
  created_at: string;
  estornado_em: string | null;
}

export interface EventoConta {
  id: number;
  tipo: "criada" | "pagamento" | "estorno" | "pagamento_reativado" | "remarcada" | "data_definida" | "cancelada" | "reativada";
  dados: Record<string, unknown>;
  em: string;
}

export type Forma = "pix" | "dinheiro" | "cartao" | "transferencia" | "outro";
export const FORMAS: Record<Forma, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  cartao: "Cartão",
  transferencia: "Transferência",
  outro: "Outro",
};

export const COR_SITUACAO: Record<SituacaoConta, { linha: string; selo: string; ponto: string; rotulo: string }> = {
  atrasada: { linha: "bg-red-500/[0.07]", selo: "bg-red-500/15 text-red-300", ponto: "bg-red-500", rotulo: "Atrasada" },
  vence_logo: { linha: "bg-orange-500/[0.06]", selo: "bg-orange-500/15 text-orange-300", ponto: "bg-orange-500", rotulo: "Vence logo" },
  em_dia: { linha: "", selo: "bg-emerald-500/15 text-emerald-300", ponto: "bg-emerald-500", rotulo: "Em dia" },
  sem_data: { linha: "", selo: "bg-hover text-muted", ponto: "bg-zinc-500", rotulo: "Sem data" },
  quitada: { linha: "", selo: "bg-sky-500/15 text-sky-300", ponto: "bg-sky-500", rotulo: "Quitada" },
  cancelada: { linha: "opacity-50", selo: "bg-hover text-faint", ponto: "bg-zinc-600", rotulo: "Cancelada" },
};
