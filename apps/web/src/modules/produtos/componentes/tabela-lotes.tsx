"use client";

import { custoPorGrama, formatBRL, formatGrams } from "@ct/core";
import { ThOrdem, useOrdenacao, type OpcaoOrdem } from "@/components/ui/ordenacao";
import { formatData } from "@/lib/datas";
import type { LoteSaldo } from "../tipos";
import { SeloVencimento } from "./card";

const ORDEM: OpcaoOrdem<LoteSaldo>[] = [
  { id: "data", rotulo: "Data", valor: (l) => l.data_compra, padrao: "desc" },
  { id: "fornecedor", rotulo: "Fornecedor", valor: (l) => l.fornecedor?.nome },
  { id: "qtd", rotulo: "Comprado", valor: (l) => l.quantidade_dg, padrao: "desc" },
  { id: "resta", rotulo: "Resta", valor: (l) => l.restante_dg, padrao: "desc" },
  { id: "pago", rotulo: "Pago", valor: (l) => l.custo_total_cents, padrao: "desc" },
  { id: "custo", rotulo: "Custo/g", valor: (l) => custoPorGrama(l.custo_total_cents, l.quantidade_dg), padrao: "desc" },
  { id: "pagamento", rotulo: "Pagamento", valor: (l) => l.vencimento ?? "" },
];

export function TabelaLotes({ lotes }: { lotes: LoteSaldo[] }) {
  const ord = useOrdenacao(lotes, ORDEM, "data");
  if (!lotes.length) return <p className="py-6 text-center text-sm text-muted">Nenhuma entrada ainda.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="border-b border-line text-left">
          <tr>
            {ORDEM.map((o) => (
              <ThOrdem key={o.id} rotulo={o.rotulo} col={o.id} {...ord} className="px-2 py-2" />
            ))}
          </tr>
        </thead>
        <tbody>
          {ord.ordenados.map((l) => {
            const cg = custoPorGrama(l.custo_total_cents, l.quantidade_dg);
            return (
              <tr key={l.id} className="border-b border-line/60 last:border-0">
                <td className="px-2 py-2 tabular-nums">{formatData(l.data_compra)}</td>
                <td className="px-2 py-2">{l.fornecedor?.nome ?? <span className="text-faint">—</span>}</td>
                <td className="px-2 py-2 tabular-nums">{formatGrams(l.quantidade_dg)}</td>
                <td className="px-2 py-2 tabular-nums">
                  {l.restante_dg > 0 ? formatGrams(l.restante_dg) : <span className="text-faint">esgotado</span>}
                </td>
                <td className="px-2 py-2 tabular-nums">{formatBRL(l.custo_total_cents)}</td>
                <td className="px-2 py-2 tabular-nums">{cg !== null ? formatBRL(cg) : "—"}</td>
                <td className="px-2 py-2">
                  {l.pagamento === "avista" ? (
                    <span className="text-xs text-muted">À vista</span>
                  ) : (
                    <SeloVencimento data={l.vencimento} />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
