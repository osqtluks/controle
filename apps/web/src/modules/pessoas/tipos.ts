import type { StatusCliente } from "@ct/core";

export interface HorarioEntrega {
  /** 0 = domingo … 6 = sábado */
  dias: number[];
  de: string; // "18:00"
  ate: string; // "22:00"
}

export interface Pessoa {
  id: string;
  nome: string;
  apelido: string | null;
  tipo: "cliente" | "fornecedor" | "ambos";
  telefone: string | null;
  observacoes: string | null;
  endereco: string | null;
  referencia: string | null;
  horarios_entrega: HorarioEntrega[];
  aniversario: string | null;
  indicado_por: string | null;
  indicado_em: string | null;
  created_at: string;
}

export const CAMPOS_PESSOA =
  "id, nome, apelido, tipo, telefone, observacoes, endereco, referencia, horarios_entrega, aniversario, indicado_por, indicado_em, created_at";

export const TIPO_PESSOA: Record<Pessoa["tipo"], string> = {
  cliente: "Cliente",
  fornecedor: "Fornecedor",
  ambos: "Cliente e fornecedor",
};

export const DIAS_CURTOS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** "Seg–Sex 18:00–22:00" / "Sáb, Dom 10:00–14:00" */
export function descreverHorario(h: HorarioEntrega): string {
  const d = [...h.dias].sort((a, b) => a - b);
  const seguidos = d.length > 2 && d.every((x, i) => i === 0 || x === d[i - 1]! + 1);
  const dias =
    d.length === 7 ? "Todo dia" : seguidos ? `${DIAS_CURTOS[d[0]!]}–${DIAS_CURTOS[d.at(-1)!]}` : d.map((x) => DIAS_CURTOS[x]).join(", ");
  return `${dias} ${h.de}–${h.ate}`;
}

/** Ex.: "Sex" é dia de entrega? (para avisos na venda) */
export function entregaHoje(hs: HorarioEntrega[], diaSemana: number): HorarioEntrega[] {
  return hs.filter((h) => h.dias.includes(diaSemana));
}

export const COR_STATUS: Record<StatusCliente, string> = {
  sem_compras: "bg-white/5 text-muted",
  novo: "bg-sky-500/15 text-sky-300",
  ativo: "bg-emerald-500/15 text-emerald-300",
  esfriando: "bg-orange-500/15 text-orange-300",
  parado: "bg-red-500/15 text-red-300",
};
