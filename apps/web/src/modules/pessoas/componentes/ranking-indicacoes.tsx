"use client";

import Link from "next/link";
import { formatBps, type BonusIndicacao, type LinhaRanking } from "@ct/core";
import { useOrdenacao, type OpcaoOrdem } from "@/components/ui/ordenacao";
import { cn } from "@/lib/cn";

export type LinhaComBonus = LinhaRanking & { bonus: BonusIndicacao };

const ORDEM: OpcaoOrdem<LinhaComBonus>[] = [
  { id: "posicao", rotulo: "Posição", valor: (l) => l.posicao },
  { id: "nome", rotulo: "Quem indicou", valor: (l) => l.nome },
  { id: "ativos", rotulo: "Ativos", valor: (l) => l.ativos, padrao: "desc" },
  { id: "total", rotulo: "Indicou", valor: (l) => l.indicados.length, padrao: "desc" },
  { id: "semanas", rotulo: "Semanas no top", valor: (l) => l.bonus.semanasSeguidas, padrao: "desc" },
  { id: "bonus", rotulo: "Desconto", valor: (l) => l.bonus.totalBps, padrao: "desc" },
];

const MEDALHA = ["🥇", "🥈", "🥉"];

export function RankingIndicacoes({ linhas }: { linhas: LinhaComBonus[] }) {
  const ord = useOrdenacao(linhas, ORDEM, "posicao");
  if (!linhas.length)
    return (
      <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">
        Ninguém indicou ainda. No cadastro da pessoa, preencha “Indicado por”.
      </p>
    );
  const seta = (id: string) => (ord.id === id ? (ord.dir === "asc" ? " ↑" : " ↓") : "");
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-card">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-faint">
          <tr>
            {ORDEM.map((o) => (
              <th key={o.id} className={cn("px-3 py-2.5", ["ativos", "total", "semanas", "bonus"].includes(o.id) && "text-right")}>
                <button type="button" onClick={() => ord.alternar(o.id)} className="uppercase hover:text-fg">
                  {o.rotulo}
                  {seta(o.id)}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line/60">
          {ord.ordenados.map((l) => {
            const top = l.posicao !== null && l.posicao <= 3;
            return (
              <tr key={l.id} className={cn("align-top", top && "bg-amber-400/[0.04]")}>
                <td className="px-3 py-2.5 text-lg">{l.posicao ? (MEDALHA[l.posicao - 1] ?? `${l.posicao}º`) : <span className="text-sm text-faint">—</span>}</td>
                <td className="px-3 py-2.5">
                  <Link href={`/pessoas/${l.id}`} className="font-medium hover:underline">
                    {l.nome}
                  </Link>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {l.indicados.map((x) => (
                      <Link
                        key={x.id}
                        href={`/pessoas/${x.id}`}
                        title={x.ultimaCompra ? `última compra ${x.ultimaCompra.split("-").reverse().join("/")}` : "ainda não comprou"}
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px]",
                          x.ativo ? "bg-emerald-500/15 text-emerald-300" : "bg-white/5 text-muted line-through decoration-white/20",
                        )}
                      >
                        {x.nome}
                      </Link>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{l.ativos}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-muted">{l.indicados.length}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{l.bonus.semanasSeguidas || "—"}</td>
                <td className="px-3 py-2.5 text-right">
                  {l.bonus.totalBps ? (
                    <span className="rounded-full bg-violet-500/20 px-2 py-0.5 font-bold text-violet-200">{formatBps(l.bonus.totalBps)}</span>
                  ) : (
                    <span className="text-faint">—</span>
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
