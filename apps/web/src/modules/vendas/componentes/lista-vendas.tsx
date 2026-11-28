"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatBps, formatBRL, formatGrams, formatLucro } from "@ct/core";
import { ThOrdem, useOrdenacao, type OpcaoOrdem } from "@/components/ui/ordenacao";
import { cn } from "@/lib/cn";
import { formatData, formatDataHora, hojeISO } from "@/lib/datas";
import type { Venda } from "../tipos";

type Periodo = "hoje" | "7d" | "mes" | "tudo";
const PERIODOS: { id: Periodo; rotulo: string }[] = [
  { id: "hoje", rotulo: "Hoje" },
  { id: "7d", rotulo: "7 dias" },
  { id: "mes", rotulo: "Este mês" },
  { id: "tudo", rotulo: "Tudo" },
];

const gramas = (v: Venda) => v.itens.reduce((s, i) => s + i.quantidade_dg, 0);
/** Brinde não tem lucro (nem prejuízo): o custo dele fica fora das contas de venda. */
const lucro = (v: Venda) => (v.brinde ? 0 : v.total_cents - v.custo_cents);

const ORDEM: OpcaoOrdem<Venda>[] = [
  { id: "data", rotulo: "Data", valor: (v) => v.data, padrao: "desc" },
  { id: "numero", rotulo: "Nº", valor: (v) => v.numero, padrao: "desc" },
  { id: "cliente", rotulo: "Cliente", valor: (v) => v.cliente?.nome },
  { id: "gramas", rotulo: "Gramas", valor: gramas, padrao: "desc" },
  { id: "total", rotulo: "Total", valor: (v) => v.total_cents, padrao: "desc" },
  { id: "lucro", rotulo: "Lucro", valor: lucro, padrao: "desc" },
  { id: "pagamento", rotulo: "Pagamento", valor: (v) => (v.cancelada_em ? "z" : v.brinde ? "brinde" : v.pagamento) },
];

function inicioDo(p: Periodo): string | null {
  const hoje = hojeISO();
  if (p === "tudo") return null;
  if (p === "hoje") return hoje;
  if (p === "mes") return `${hoje.slice(0, 7)}-01`;
  const d = new Date(`${hoje}T12:00:00`);
  d.setDate(d.getDate() - 6);
  return d.toISOString().slice(0, 10);
}

export function ListaVendas({ vendas }: { vendas: Venda[] }) {
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [filtro, setFiltro] = useState<"todas" | "pago" | "fiado" | "brindes" | "canceladas">("todas");

  const filtradas = useMemo(() => {
    const ini = inicioDo(periodo);
    return vendas.filter((v) => {
      const dia = new Date(v.data).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      if (ini && dia < ini) return false;
      if (filtro === "canceladas") return !!v.cancelada_em;
      if (v.cancelada_em) return false;
      if (filtro === "brindes") return v.brinde;
      return filtro === "todas" || (!v.brinde && v.pagamento === filtro);
    });
  }, [vendas, periodo, filtro]);

  const validas = filtradas.filter((v) => !v.cancelada_em && !v.brinde);
  const faturado = validas.reduce((s, v) => s + v.total_cents, 0);
  const lucroTotal = validas.reduce((s, v) => s + lucro(v), 0);
  const ord = useOrdenacao(filtradas, ORDEM, "data");

  const chip = (ativo: boolean) =>
    cn("rounded-md px-3 py-1.5 text-sm", ativo ? "bg-hover font-medium text-fg" : "text-muted");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="flex gap-1 rounded-lg border border-line bg-card p-1">
          {PERIODOS.map((p) => (
            <button key={p.id} type="button" onClick={() => setPeriodo(p.id)} className={chip(periodo === p.id)}>
              {p.rotulo}
            </button>
          ))}
        </div>
        <div className="flex gap-1 rounded-lg border border-line bg-card p-1">
          {(["todas", "pago", "fiado", "brindes", "canceladas"] as const).map((f) => (
            <button key={f} type="button" onClick={() => setFiltro(f)} className={chip(filtro === f)}>
              {f === "todas" ? "Todas" : f === "pago" ? "Recebidas" : f === "fiado" ? "Fiado" : f === "brindes" ? "Brindes" : "Canceladas"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Faturamento", formatBRL(faturado), ""],
          ["Lucro", formatLucro(lucroTotal), lucroTotal < 0 ? "text-red-400" : "text-emerald-400"],
          ["Margem", faturado > 0 ? formatBps(Math.round((lucroTotal * 10000) / faturado)) : "—", ""],
          ["Vendas · gramas", `${validas.length} · ${formatGrams(validas.reduce((s, v) => s + gramas(v), 0))}`, ""],
        ].map(([r, v, cor]) => (
          <div key={r} className="rounded-xl border border-line bg-card p-3">
            <div className="text-[11px] text-faint">{r}</div>
            <div className={cn("text-lg font-semibold tabular-nums", cor)}>{v}</div>
          </div>
        ))}
      </div>

      {filtradas.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-10 text-center text-sm text-muted">Nenhuma venda nesse filtro.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-line text-left">
              <tr>
                {ORDEM.map((o) => (
                  <ThOrdem key={o.id} rotulo={o.rotulo} col={o.id} {...ord} className="px-3 py-2" />
                ))}
              </tr>
            </thead>
            <tbody>
              {ord.ordenados.map((v) => (
                <tr key={v.id} className={cn("border-b border-line/60 last:border-0 hover:bg-hover/50", v.cancelada_em && "opacity-50")}>
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-muted">
                    <Link href={`/vendas/${v.id}`} className="block">{formatDataHora(v.data)}</Link>
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">
                    <Link href={`/vendas/${v.id}`} className="text-accent hover:underline">#{v.numero}</Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="truncate">{v.cliente?.nome ?? <span className="text-faint">—</span>}</div>
                    <div className="truncate text-[11px] text-muted">{v.itens.map((i) => i.produto?.nome).join(", ")}</div>
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">{formatGrams(gramas(v))}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-medium tabular-nums">{formatBRL(v.total_cents)}</td>
                  <td className={cn("whitespace-nowrap px-3 py-2.5 tabular-nums", lucro(v) < 0 ? "text-red-400" : "text-emerald-400")}>
                    {v.brinde ? <span className="text-faint">—</span> : formatLucro(lucro(v))}
                  </td>
                  <td className="px-3 py-2.5">
                    {v.cancelada_em ? (
                      <span className="rounded-full bg-hover px-2 py-0.5 text-[11px] text-muted">Cancelada</span>
                    ) : v.brinde ? (
                      <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300">Brinde</span>
                    ) : v.pagamento === "fiado" ? (
                      <span className="whitespace-nowrap rounded-full bg-orange-500/15 px-2 py-0.5 text-[11px] text-orange-300">
                        Fiado{v.vencimento ? ` · ${formatData(v.vencimento)}` : ""}
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-300">Recebida</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
