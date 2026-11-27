export interface Cupom {
  id: string;
  codigo: string;
  percentual_bps: number;
  valido_de: string | null;
  valido_ate: string | null;
  limite_usos: number | null;
  descricao: string | null;
  ativo: boolean;
  created_at: string;
  usos: number;
  ultimo_uso: string | null;
}

export type SituacaoCupom = "ativo" | "agendado" | "esgotado" | "vencido" | "desativado";

export function situacaoCupom(c: Cupom, hoje: string): SituacaoCupom {
  if (!c.ativo) return "desativado";
  if (c.valido_ate && hoje > c.valido_ate) return "vencido";
  if (c.limite_usos && c.usos >= c.limite_usos) return "esgotado";
  if (c.valido_de && hoje < c.valido_de) return "agendado";
  return "ativo";
}

export const SELO_CUPOM: Record<SituacaoCupom, [string, string]> = {
  ativo: ["Valendo", "bg-emerald-500/15 text-emerald-300"],
  agendado: ["Começa depois", "bg-sky-500/15 text-sky-300"],
  esgotado: ["Esgotado", "bg-orange-500/15 text-orange-300"],
  vencido: ["Vencido", "bg-hover text-muted"],
  desativado: ["Desativado", "bg-hover text-faint"],
};

/** Código fácil de ditar: sem 0/O/1/I. */
export function gerarCodigo(prefixo = "SEMANA"): string {
  const letras = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 4; i++) s += letras[Math.floor(Math.random() * letras.length)];
  return `${prefixo}-${s}`;
}
