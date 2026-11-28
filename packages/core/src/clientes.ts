import { diasEntre, somarDias, type DataISO } from "./contas";
import { formatBps } from "./cost";
import { formatGrams, type Dg } from "./grams";
import type { Cents } from "./money";

/**
 * Regras de clientes: perfil, conquistas, brinde da 4ª compra do mês,
 * ranking de indicações e bônus. Tudo derivado das vendas (nada guardado à parte),
 * então cancelar/reativar uma venda já corrige tudo sozinho.
 */

// ───────────── parâmetros (depois vão para Ajustes) ─────────────
/** A compra de número N no mês dá brinde. */
export const BRINDE_NA_COMPRA_DO_MES = 4;
/** Indicado "ativo" = comprou nos últimos N dias. */
export const DIAS_INDICADO_ATIVO = 30;
/** Bônus pela posição no ranking (top 1, 2, 3), em pontos-base. */
export const BONUS_POSICAO_BPS = [500, 400, 300];
/** Bônus por semanas seguidas no top 3 dentro do mês (1ª, 2ª, 3ª, 4ª+), em pontos-base. */
export const BONUS_SEMANA_BPS = [500, 700, 900, 1200];

export interface ItemCompra {
  produto: string;
  dg: Dg;
}

/** Uma venda (não cancelada) do cliente. `data` é o dia em Brasília; `em` ordena dentro do dia. */
export interface CompraCliente {
  id: string;
  data: DataISO;
  em: string;
  totalCents: Cents;
  brinde: boolean;
  itens: ItemCompra[];
}

const ordenarCompras = (cs: readonly CompraCliente[]) => [...cs].sort((a, b) => (a.em < b.em ? -1 : a.em > b.em ? 1 : 0));
const mesDe = (d: DataISO) => d.slice(0, 7);

/** Segunda-feira da semana de `d`. */
export function inicioDaSemana(d: DataISO): DataISO {
  const [a, m, dia] = d.split("-").map(Number);
  const dow = new Date(Date.UTC(a!, m! - 1, dia!)).getUTCDay(); // 0 = domingo
  return somarDias(d, -((dow + 6) % 7));
}

/** Semana do mês: dias 1–7 = 1, 8–14 = 2, 15–21 = 3, 22 em diante = 4. */
export function semanaDoMes(d: DataISO): number {
  return Math.min(4, Math.floor((Number(d.slice(8, 10)) - 1) / 7) + 1);
}

// ───────────── perfil ─────────────
export type StatusCliente = "sem_compras" | "novo" | "ativo" | "esfriando" | "parado";

export interface PerfilCliente {
  compras: number;
  gastoCents: Cents;
  ticketMedioCents: Cents;
  gramasDg: Dg;
  primeira: DataISO | null;
  ultima: DataISO | null;
  diasSemComprar: number | null;
  /** Média de dias entre compras (precisa de 2+ compras). */
  intervaloMedio: number | null;
  /** Quando deve voltar, pelo intervalo médio. */
  previsaoProxima: DataISO | null;
  comprasNoMes: number;
  comprasNaSemana: number;
  brindes: number;
  favorito: { produto: string; dg: Dg } | null;
  status: StatusCliente;
}

export const ROTULO_STATUS: Record<StatusCliente, string> = {
  sem_compras: "Sem compras",
  novo: "Novo",
  ativo: "Ativo",
  esfriando: "Esfriando",
  parado: "Parado",
};

export function perfilCliente(todas: readonly CompraCliente[], hoje: DataISO): PerfilCliente {
  const cs = ordenarCompras(todas);
  const compras = cs.filter((c) => !c.brinde);
  const gasto = compras.reduce((s, c) => s + c.totalCents, 0);
  const gramas = compras.reduce((s, c) => s + c.itens.reduce((x, i) => x + i.dg, 0), 0);
  const primeira = compras[0]?.data ?? null;
  const ultima = compras.at(-1)?.data ?? null;
  const dias = ultima ? diasEntre(ultima, hoje) : null;
  const intervalo =
    compras.length >= 2 && primeira && ultima ? Math.round(diasEntre(primeira, ultima) / (compras.length - 1)) : null;

  const porProduto = new Map<string, Dg>();
  for (const c of compras) for (const i of c.itens) porProduto.set(i.produto, (porProduto.get(i.produto) ?? 0) + i.dg);
  let favorito: PerfilCliente["favorito"] = null;
  for (const [produto, dg] of porProduto) if (!favorito || dg > favorito.dg) favorito = { produto, dg };

  const semana = inicioDaSemana(hoje);
  let status: StatusCliente = "sem_compras";
  if (dias !== null) status = compras.length === 1 && dias <= 30 ? "novo" : dias <= 30 ? "ativo" : dias <= 60 ? "esfriando" : "parado";

  return {
    compras: compras.length,
    gastoCents: gasto,
    ticketMedioCents: compras.length ? Math.round(gasto / compras.length) : 0,
    gramasDg: gramas,
    primeira,
    ultima,
    diasSemComprar: dias,
    intervaloMedio: intervalo,
    previsaoProxima: intervalo !== null && ultima ? somarDias(ultima, Math.max(1, intervalo)) : null,
    comprasNoMes: compras.filter((c) => mesDe(c.data) === mesDe(hoje)).length,
    comprasNaSemana: compras.filter((c) => c.data >= semana && c.data <= hoje).length,
    brindes: cs.filter((c) => c.brinde).length,
    favorito,
    status,
  };
}

// ───────────── brinde da 4ª compra ─────────────
export interface BrindeDoMes {
  comprasNoMes: number;
  /** Já chegou na compra que dá brinde neste mês. */
  ganhou: boolean;
  /** Já recebeu um brinde neste mês. */
  entregue: boolean;
  faltam: number;
}

export function brindeDoMes(todas: readonly CompraCliente[], hoje: DataISO): BrindeDoMes {
  const doMes = todas.filter((c) => mesDe(c.data) === mesDe(hoje));
  const n = doMes.filter((c) => !c.brinde).length;
  return {
    comprasNoMes: n,
    ganhou: n >= BRINDE_NA_COMPRA_DO_MES,
    entregue: doMes.some((c) => c.brinde),
    faltam: Math.max(0, BRINDE_NA_COMPRA_DO_MES - n),
  };
}

// ───────────── conquistas ─────────────
export type TipoConquista = "primeira" | "marco" | "semana" | "mes" | "premio" | "brinde" | "indicacao" | "retorno";

export interface Conquista {
  data: DataISO;
  em: string;
  tipo: TipoConquista;
  texto: string;
}

const MARCOS = [5, 10, 20, 30, 50, 75, 100, 150, 200];
const DIAS_RETORNO = 30;

export function conquistas(todas: readonly CompraCliente[], indicou: readonly { nome: string; data: DataISO }[] = []): Conquista[] {
  const out: Conquista[] = [];
  const porSemana = new Map<string, number>();
  const porMes = new Map<string, number>();
  let total = 0;
  let anterior: DataISO | null = null;

  for (const c of ordenarCompras(todas)) {
    if (c.brinde) {
      const oq = c.itens.map((i) => `${i.produto} ${formatGrams(i.dg)}`).join(", ");
      out.push({ data: c.data, em: c.em, tipo: "brinde", texto: `Recebeu brinde: ${oq}` });
      continue;
    }
    total++;
    const s = inicioDaSemana(c.data);
    const m = mesDe(c.data);
    const ns = (porSemana.get(s) ?? 0) + 1;
    const nm = (porMes.get(m) ?? 0) + 1;
    porSemana.set(s, ns);
    porMes.set(m, nm);
    const add = (tipo: TipoConquista, texto: string) => out.push({ data: c.data, em: c.em, tipo, texto });

    if (total === 1) add("primeira", "Primeira compra");
    else if (anterior && diasEntre(anterior, c.data) >= DIAS_RETORNO)
      add("retorno", `Voltou a comprar depois de ${diasEntre(anterior, c.data)} dias`);
    if (MARCOS.includes(total)) add("marco", `${total}ª compra no total`);
    if (ns >= 2) add("semana", `${ns}ª compra na semana`);
    if (nm >= 3) add("mes", `${nm}ª compra no mês`);
    if (nm === BRINDE_NA_COMPRA_DO_MES) add("premio", `Ganhou direito a brinde (${nm}ª compra do mês)`);
    anterior = c.data;
  }
  for (const i of indicou) out.push({ data: i.data, em: `${i.data}T12:00:00`, tipo: "indicacao", texto: `Indicou ${i.nome}` });

  return out.sort((a, b) => (a.em < b.em ? 1 : a.em > b.em ? -1 : 0));
}

// ───────────── indicações ─────────────
export interface PessoaIndicacao {
  id: string;
  nome: string;
  indicadoPor: string | null;
}

/** Só a data de cada venda (não cancelada, sem brinde) por cliente. */
export interface VendaResumo {
  clienteId: string;
  data: DataISO;
}

export interface Indicado {
  id: string;
  nome: string;
  ultimaCompra: DataISO | null;
  ativo: boolean;
}

export interface LinhaRanking {
  id: string;
  nome: string;
  indicados: Indicado[];
  ativos: number;
  /** 1, 2, 3… só para quem tem pelo menos 1 indicado ativo. */
  posicao: number | null;
}

function ultimasCompras(vendas: readonly VendaResumo[], dia: DataISO): Map<string, DataISO> {
  const m = new Map<string, DataISO>();
  for (const v of vendas) if (v.data <= dia && (m.get(v.clienteId) ?? "") < v.data) m.set(v.clienteId, v.data);
  return m;
}

/** Ranking de quem mais indicou clientes que continuam comprando (ativos no dia). */
export function rankingIndicacoes(pessoas: readonly PessoaIndicacao[], vendas: readonly VendaResumo[], dia: DataISO): LinhaRanking[] {
  const ultima = ultimasCompras(vendas, dia);
  const porId = new Map(pessoas.map((p) => [p.id, p]));
  const linhas = new Map<string, LinhaRanking>();
  for (const p of pessoas) {
    if (!p.indicadoPor || !porId.has(p.indicadoPor)) continue;
    const ref = porId.get(p.indicadoPor)!;
    const l = linhas.get(ref.id) ?? { id: ref.id, nome: ref.nome, indicados: [], ativos: 0, posicao: null };
    const u = ultima.get(p.id) ?? null;
    const ativo = u !== null && diasEntre(u, dia) < DIAS_INDICADO_ATIVO;
    l.indicados.push({ id: p.id, nome: p.nome, ultimaCompra: u, ativo });
    if (ativo) l.ativos++;
    linhas.set(ref.id, l);
  }
  const ord = [...linhas.values()].sort(
    (a, b) => b.ativos - a.ativos || b.indicados.length - a.indicados.length || a.nome.localeCompare(b.nome, "pt-BR"),
  );
  let pos = 0;
  for (const l of ord) if (l.ativos > 0) l.posicao = ++pos;
  return ord;
}

export interface BonusIndicacao {
  posicao: number | null;
  /** Semanas seguidas no top 3 dentro deste mês (contando a atual). */
  semanasSeguidas: number;
  posicaoBps: number;
  semanaBps: number;
  totalBps: number;
}

const SEM_BONUS = (posicao: number | null): BonusIndicacao => ({ posicao, semanasSeguidas: 0, posicaoBps: 0, semanaBps: 0, totalBps: 0 });

/**
 * Bônus de quem indica: só vale no top 3. Soma o da posição (5/4/3%) com o das semanas
 * seguidas no top 3 dentro do mês (5 → 7 → 9 → 12%). Saiu do top 3, zera a sequência.
 * Semanas anteriores são conferidas no último dia de cada uma (7, 14, 21).
 */
export function bonusIndicacao(
  id: string,
  pessoas: readonly PessoaIndicacao[],
  vendas: readonly VendaResumo[],
  hoje: DataISO,
): BonusIndicacao {
  const posicaoEm = (dia: DataISO) => rankingIndicacoes(pessoas, vendas, dia).find((l) => l.id === id)?.posicao ?? null;
  const posicao = posicaoEm(hoje);
  if (posicao === null || posicao > 3) return SEM_BONUS(posicao);

  let seguidas = 1;
  for (let s = semanaDoMes(hoje) - 1; s >= 1; s--) {
    const p = posicaoEm(`${hoje.slice(0, 8)}${String(s * 7).padStart(2, "0")}`);
    if (p === null || p > 3) break;
    seguidas++;
  }
  const posicaoBps = BONUS_POSICAO_BPS[posicao - 1] ?? 0;
  const semanaBps = BONUS_SEMANA_BPS[Math.min(seguidas, BONUS_SEMANA_BPS.length) - 1] ?? 0;
  return { posicao, semanasSeguidas: seguidas, posicaoBps, semanaBps, totalBps: posicaoBps + semanaBps };
}

export function descreverBonus(b: BonusIndicacao): string {
  if (!b.totalBps) return "";
  const sem = b.semanasSeguidas === 1 ? "1ª semana no top 3" : `${b.semanasSeguidas} semanas seguidas no top 3`;
  return `Top ${b.posicao} (+${formatBps(b.posicaoBps)}) · ${sem} (+${formatBps(b.semanaBps)})`;
}

// ───────────── mensagens depois da venda ─────────────
export interface Mensagem {
  para: string;
  telefone: string | null;
  titulo: string;
  texto: string;
}

const ordinal = (n: number) => `${n}ª`;
const primeiroNome = (n: string) => n.trim().split(/\s+/)[0] ?? n;

/**
 * Cruza o que se sabe do cliente depois de uma venda e monta mensagens prontas para copiar.
 * `compras` = todas as compras do cliente já incluindo esta venda.
 */
export function mensagensPosVenda(i: {
  cliente: { nome: string; telefone: string | null };
  compras: readonly CompraCliente[];
  vendaId: string;
  hoje: DataISO;
  bonusCliente: BonusIndicacao;
  indicador: { nome: string; telefone: string | null; bonus: BonusIndicacao } | null;
}): Mensagem[] {
  const nome = primeiroNome(i.cliente.nome);
  const venda = i.compras.find((c) => c.id === i.vendaId);
  if (!venda || venda.brinde) return [];
  const doMes = ordenarCompras(i.compras.filter((c) => !c.brinde && mesDe(c.data) === mesDe(venda.data)));
  const n = doMes.findIndex((c) => c.id === i.vendaId) + 1;
  const perfil = perfilCliente(i.compras, i.hoje);
  const out: Mensagem[] = [];

  const partes = [`Oi, ${nome}! Obrigado pela compra 🙌`];
  if (n === BRINDE_NA_COMPRA_DO_MES)
    partes.push(`Essa foi sua ${ordinal(n)} compra este mês e você ganhou um BRINDE 🎁 Vou separar pra você!`);
  else if (n > 0 && n < BRINDE_NA_COMPRA_DO_MES)
    partes.push(
      `Essa foi sua ${ordinal(n)} compra este mês. ${
        BRINDE_NA_COMPRA_DO_MES - n === 1 ? "Na próxima" : `Faltam ${BRINDE_NA_COMPRA_DO_MES - n}`
      } pra ganhar um brinde 🎁`,
    );
  else if (n > BRINDE_NA_COMPRA_DO_MES) partes.push(`Já são ${n} compras este mês, valeu demais pela parceria!`);
  if (perfil.compras === 1) partes.push("Seja bem-vindo(a)! 🤝");
  if (i.bonusCliente.totalBps)
    partes.push(
      `Você está em ${i.bonusCliente.posicao}º lugar no ranking de indicações: seu desconto agora é de ${formatBps(i.bonusCliente.totalBps)} 🔥`,
    );
  out.push({ para: i.cliente.nome, telefone: i.cliente.telefone, titulo: `Para ${i.cliente.nome}`, texto: partes.join("\n") });

  if (i.indicador) {
    const ind = primeiroNome(i.indicador.nome);
    const b = i.indicador.bonus;
    const extra = b.totalBps
      ? ` Você está em ${b.posicao}º lugar no ranking e seu desconto é de ${formatBps(b.totalBps)} 🔥`
      : b.posicao
        ? ` Você está em ${b.posicao}º lugar no ranking de indicações — chegando no top 3 você ganha desconto!`
        : "";
    out.push({
      para: i.indicador.nome,
      telefone: i.indicador.telefone,
      titulo: `Para ${i.indicador.nome} (indicou ${nome})`,
      texto: `Oi, ${ind}! ${nome}, que você indicou, fez mais um pedido. Obrigado pela indicação! 🙌${extra}`,
    });
  }
  return out;
}
