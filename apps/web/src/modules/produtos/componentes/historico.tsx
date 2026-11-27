import { formatBRL, formatGrams } from "@ct/core";
import { formatData, formatDataHora } from "@/lib/datas";
import type { EventoHistorico } from "../tipos";

type Nomes = Record<string, string>;
type Fmt = (v: unknown, nomes: Nomes) => string;

const vazio = (v: unknown) => v === null || v === undefined || v === "";
const dinheiro: Fmt = (v) => (vazio(v) ? "vazio" : formatBRL(Number(v)));
const gramas: Fmt = (v) => formatGrams(Number(v));
const textoFmt: Fmt = (v) => (vazio(v) ? "vazio" : `"${String(v)}"`);
const faixasFmt: Fmt = (v) =>
  Array.isArray(v) && v.length
    ? (v as { min_dg: number; preco_cents: number }[])
        .map((f) => `${formatGrams(f.min_dg)}+ ${formatBRL(f.preco_cents)}`)
        .join(" · ")
    : "nenhuma";
const pessoa: Fmt = (v, n) => (vazio(v) ? "nenhum" : (n[String(v)] ?? "outro fornecedor"));

/** Campos do produto que aparecem no histórico, com nome amigável e formato. */
const CAMPOS_PRODUTO: [string, string, Fmt][] = [
  ["nome", "o nome", textoFmt],
  ["categoria", "a categoria", textoFmt],
  ["fornecedor_id", "o fornecedor", pessoa],
  ["custo_ref_cents_por_grama", "o valor pago por grama", dinheiro],
  ["faixas", "as faixas de preço", faixasFmt],
  ["preco_10g_cents_por_grama", "o valor de 10 g+", dinheiro],
  ["preco_30g_cents_por_grama", "o valor de 30 g+", dinheiro],
  ["lim_cheio_dg", "o nível cheio", gramas],
  ["lim_metade_dg", "o nível metade", gramas],
  ["lim_acabando_dg", "o nível chegando ao fim", gramas],
  ["lim_muito_baixo_dg", "o nível muito baixo", gramas],
  ["lim_acabou_dg", "o nível acabou", gramas],
  ["descricao", "a descrição", textoFmt],
  ["observacoes", "as observações", textoFmt],
];

const CAMPOS_LOTE: [string, string, Fmt][] = [
  ["fornecedor_id", "o fornecedor", pessoa],
  ["observacoes", "as observações", textoFmt],
];

interface Linha {
  chave: string;
  em: string;
  texto: string;
  de?: string;
  para?: string;
}

const igual = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

function linhas(e: EventoHistorico, nomes: Nomes): Linha[] {
  const a = e.antes ?? {};
  const d = e.depois ?? {};
  const base = { em: e.em };

  if (e.tabela === "lotes") {
    if (e.acao === "criou") {
      const prazo = d.pagamento === "prazo" ? `a prazo, vence ${formatData(String(d.vencimento))}` : "à vista";
      const forn = d.fornecedor_id ? ` de ${pessoa(d.fornecedor_id, nomes)}` : "";
      return [
        {
          ...base,
          chave: `${e.id}`,
          texto: `Você deu entrada de ${formatGrams(Number(d.quantidade_dg))}${forn} por ${formatBRL(Number(d.custo_total_cents))} (${prazo})`,
        },
      ];
    }
    const qual = `da entrada de ${formatData(String(d.data_compra))} (${formatGrams(Number(d.quantidade_dg))})`;
    return CAMPOS_LOTE.filter(([k]) => !igual(a[k], d[k])).map(([k, rot, fmt]) => ({
      ...base,
      chave: `${e.id}-${k}`,
      texto: `Você mudou ${rot} ${qual}`,
      de: fmt(a[k], nomes),
      para: fmt(d[k], nomes),
    }));
  }

  if (e.acao === "criou") return [{ ...base, chave: `${e.id}`, texto: "Você cadastrou o produto" }];
  if (e.acao === "apagou") return [{ ...base, chave: `${e.id}`, texto: "Você apagou o produto" }];

  const out: Linha[] = CAMPOS_PRODUTO.filter(([k]) => !igual(a[k], d[k])).map(([k, rot, fmt]) => ({
    ...base,
    chave: `${e.id}-${k}`,
    texto: `Você mudou ${rot}`,
    de: fmt(a[k], nomes),
    para: fmt(d[k], nomes),
  }));
  if (!igual(a.foto_path, d.foto_path)) out.push({ ...base, chave: `${e.id}-foto`, texto: "Você trocou a foto" });
  if (!igual(a.arquivado, d.arquivado))
    out.push({ ...base, chave: `${e.id}-arq`, texto: d.arquivado ? "Você mandou o produto para a Lixeira" : "Você restaurou o produto da Lixeira" });
  return out;
}

/** Uma linha por alteração: "Você mudou o valor de 3 g+ de R$ 90,00 para R$ 100,00", com data e hora. */
export function Historico({ eventos, nomes }: { eventos: EventoHistorico[]; nomes: Nomes }) {
  const todas = eventos.flatMap((e) => linhas(e, nomes));
  if (!todas.length) return <p className="text-sm text-muted">Nenhuma alteração ainda.</p>;
  return (
    <ul className="max-h-72 divide-y divide-line/60 overflow-y-auto pr-1">
      {todas.map((l) => (
        <li key={l.chave} className="flex flex-col gap-0.5 py-2 text-sm sm:flex-row sm:gap-3">
          <time className="shrink-0 text-[11px] tabular-nums text-faint sm:w-28 sm:pt-0.5">{formatDataHora(l.em)}</time>
          <span>
            {l.texto}
            {l.de !== undefined && (
              <>
                {" de "}
                <span className="text-muted line-through decoration-red-400/60">{l.de}</span>
                {" para "}
                <span className="font-medium text-accent">{l.para}</span>
              </>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
