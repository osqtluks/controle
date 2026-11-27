import type { Cents } from "./money";

/** Datas são sempre "YYYY-MM-DD" (sem fuso). */
export type DataISO = string;

export type Intervalo = "mensal" | "quinzenal" | "semanal";

/** Antecedência (em dias) para uma conta ficar laranja ("vence logo"). */
export const DIAS_ALERTA_PADRAO = 3;

function utc(d: DataISO): number {
  const [a, m, dia] = d.slice(0, 10).split("-").map(Number);
  return Date.UTC(a!, m! - 1, dia!);
}

function iso(ms: number): DataISO {
  return new Date(ms).toISOString().slice(0, 10);
}

export function diasEntre(de: DataISO, ate: DataISO): number {
  return Math.round((utc(ate) - utc(de)) / 86_400_000);
}

export function somarDias(d: DataISO, n: number): DataISO {
  return iso(utc(d) + n * 86_400_000);
}

/** Soma meses mantendo o dia (31/01 + 1 mês = 28 ou 29/02). */
export function somarMeses(d: DataISO, n: number): DataISO {
  const [a, m, dia] = d.split("-").map(Number);
  const alvo = new Date(Date.UTC(a!, m! - 1 + n, 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(dia!, ultimo));
  return iso(alvo.getTime());
}

export interface ParcelaPlano {
  numero: number;
  valorCents: Cents;
  vencimento: DataISO;
}

/**
 * Divide `total` em `n` parcelas iguais; os centavos que sobram vão para as primeiras.
 * R$ 100,00 em 3 → 33,34 + 33,33 + 33,33.
 */
export function gerarParcelas(total: Cents, n: number, primeiro: DataISO, intervalo: Intervalo): ParcelaPlano[] {
  if (!Number.isSafeInteger(total) || total <= 0) throw new Error("valor inválido");
  if (!Number.isInteger(n) || n < 1 || n > 120) throw new Error("número de parcelas inválido");
  const base = Math.floor(total / n);
  const sobra = total - base * n;
  return Array.from({ length: n }, (_, i) => ({
    numero: i + 1,
    valorCents: base + (i < sobra ? 1 : 0),
    vencimento:
      intervalo === "mensal" ? somarMeses(primeiro, i) : somarDias(primeiro, i * (intervalo === "quinzenal" ? 15 : 7)),
  }));
}

export interface ParcelaAberta {
  id: string;
  restanteCents: Cents;
}

/**
 * Baixa de qualquer valor: abate da parcela mais antiga em aberto para a mais nova.
 * Pagou a mais que a parcela? O resto adianta as próximas. Pagou a menos? A parcela fica parcial.
 * Não aceita pagar mais do que o total que falta.
 */
export function alocarPagamento(parcelas: ParcelaAberta[], valor: Cents): { parcelaId: string; valorCents: Cents }[] {
  if (!Number.isSafeInteger(valor) || valor <= 0) throw new Error("valor inválido");
  const falta = parcelas.reduce((s, p) => s + Math.max(0, p.restanteCents), 0);
  if (valor > falta) throw new Error("valor maior que o que falta");
  const out: { parcelaId: string; valorCents: Cents }[] = [];
  let resto = valor;
  for (const p of parcelas) {
    if (resto === 0) break;
    if (p.restanteCents <= 0) continue;
    const v = Math.min(resto, p.restanteCents);
    out.push({ parcelaId: p.id, valorCents: v });
    resto -= v;
  }
  return out;
}

export type SituacaoConta = "quitada" | "atrasada" | "vence_logo" | "em_dia" | "sem_data" | "cancelada";

export interface InfoSituacao {
  situacao: SituacaoConta;
  /** > 0: dias de atraso; < 0: faltam X dias; 0: vence hoje; null: sem data. */
  dias: number | null;
}

/** Vermelho = atrasada · laranja = vence em até `diasAlerta` dias (ou hoje) · verde = em dia. */
export function situacaoDe(
  restante: Cents,
  vencimento: DataISO | null,
  hoje: DataISO,
  diasAlerta = DIAS_ALERTA_PADRAO,
  cancelada = false,
): InfoSituacao {
  if (cancelada) return { situacao: "cancelada", dias: null };
  if (restante <= 0) return { situacao: "quitada", dias: null };
  if (!vencimento) return { situacao: "sem_data", dias: null };
  const atraso = diasEntre(vencimento, hoje);
  if (atraso > 0) return { situacao: "atrasada", dias: atraso };
  if (-atraso <= diasAlerta) return { situacao: "vence_logo", dias: atraso };
  return { situacao: "em_dia", dias: atraso };
}

/** Texto curto: "3 dias atrasada", "vence hoje", "vence amanhã", "vence em 5 dias". */
export function descreverPrazo(i: InfoSituacao): string {
  if (i.situacao === "quitada") return "quitada";
  if (i.situacao === "cancelada") return "cancelada";
  if (i.dias === null) return "sem data";
  if (i.dias > 0) return i.dias === 1 ? "1 dia atrasada" : `${i.dias} dias atrasada`;
  if (i.dias === 0) return "vence hoje";
  if (i.dias === -1) return "vence amanhã";
  return `vence em ${-i.dias} dias`;
}
