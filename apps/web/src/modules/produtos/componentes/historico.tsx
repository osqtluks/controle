import { formatBRL, formatGrams } from "@ct/core";
import { formatData, formatDataHora } from "@/lib/datas";
import type { EventoHistorico } from "../tipos";

const ROTULO: Record<string, [string, (v: unknown) => string]> = {
  nome: ["Nome", String],
  categoria: ["Categoria", (v) => (v ? String(v) : "—")],
  descricao: ["Descrição", (v) => (v ? String(v) : "—")],
  observacoes: ["Observações", (v) => (v ? String(v) : "—")],
  preco_cents_por_grama: ["Preço/g", (v) => formatBRL(Number(v))],
  lim_cheio_dg: ["Nível cheio", (v) => formatGrams(Number(v))],
  lim_metade_dg: ["Nível metade", (v) => formatGrams(Number(v))],
  lim_acabando_dg: ["Nível chegando ao fim", (v) => formatGrams(Number(v))],
  lim_muito_baixo_dg: ["Nível muito baixo", (v) => formatGrams(Number(v))],
  lim_acabou_dg: ["Nível acabou", (v) => formatGrams(Number(v))],
  foto_path: ["Foto", (v) => (v ? "nova foto" : "sem foto")],
  arquivado: ["Arquivado", (v) => (v ? "sim" : "não")],
};

function descrever(e: EventoHistorico): string[] {
  if (e.tabela === "lotes" && e.depois) {
    const d = e.depois;
    const prazo = d.pagamento === "prazo" ? `a prazo, vence ${formatData(String(d.vencimento))}` : "à vista";
    return [
      `Entrada de ${formatGrams(Number(d.quantidade_dg))} por ${formatBRL(Number(d.custo_total_cents))} (${prazo})`,
    ];
  }
  if (e.acao === "criou") return ["Produto cadastrado"];
  if (e.acao === "apagou") return ["Produto apagado"];
  const a = e.antes ?? {};
  const d = e.depois ?? {};
  return Object.keys(ROTULO)
    .filter((k) => JSON.stringify(a[k]) !== JSON.stringify(d[k]))
    .map((k) => {
      const [rot, fmt] = ROTULO[k]!;
      return `${rot}: ${fmt(a[k])} → ${fmt(d[k])}`;
    });
}

export function Historico({ eventos }: { eventos: EventoHistorico[] }) {
  if (!eventos.length) return <p className="text-sm text-muted">Sem alterações registradas.</p>;
  return (
    <ol className="relative space-y-3 border-l border-line pl-4">
      {eventos.map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full border-2 border-bg bg-accent" />
          <time className="text-[11px] text-faint">{formatDataHora(e.em)}</time>
          {descrever(e).map((t, i) => (
            <p key={i} className="text-sm">
              {t}
            </p>
          ))}
        </li>
      ))}
    </ol>
  );
}
