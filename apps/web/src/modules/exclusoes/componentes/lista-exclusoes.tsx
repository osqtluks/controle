"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { formatGrams } from "@ct/core";
import { ThOrdem, useOrdenacao, type OpcaoOrdem } from "@/components/ui/ordenacao";
import { cn } from "@/lib/cn";
import { formatDataHora } from "@/lib/datas";
import { restaurarExclusao } from "@/modules/produtos/acoes";
import { situacao, type Exclusao, type Situacao } from "../tipos";

type Linha = Exclusao & { sit: Situacao };

const ORDEM: OpcaoOrdem<Linha>[] = [
  { id: "em", rotulo: "Quando", valor: (e) => e.em, padrao: "desc" },
  { id: "nome", rotulo: "O que", valor: (e) => e.nome },
  { id: "tipo", rotulo: "Tipo", valor: (e) => e.tipo },
  { id: "sit", rotulo: "Situação", valor: (e) => e.sit },
];

const SELO: Record<Situacao, [string, string]> = {
  pode_voltar: ["Excluído", "bg-red-500/15 text-red-300"],
  restaurado: ["Restaurado", "bg-emerald-500/15 text-emerald-300"],
  substituida: ["Depois excluído de vez", "bg-hover text-muted"],
};

function Voltar({ e }: { e: Linha }) {
  const [pendente, iniciar] = useTransition();
  if (e.sit !== "pode_voltar") return null;
  return (
    <button
      type="button"
      disabled={pendente}
      onClick={() =>
        iniciar(async () => {
          try {
            await restaurarExclusao(e.id);
            toast.success(`"${e.nome}" voltou como estava.`);
          } catch (err) {
            toast.error((err as Error).message);
          }
        })
      }
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-60"
    >
      <RotateCcw size={13} /> {pendente ? "Voltando…" : "Voltar a esse estado"}
    </button>
  );
}

export function ListaExclusoes({ exclusoes }: { exclusoes: Exclusao[] }) {
  const [soPendentes, setSoPendentes] = useState(false);
  const linhas = useMemo(
    () => exclusoes.map((e) => ({ ...e, sit: situacao(e, exclusoes) })).filter((e) => !soPendentes || e.sit === "pode_voltar"),
    [exclusoes, soPendentes],
  );
  const ord = useOrdenacao(linhas, ORDEM, "em");

  if (!exclusoes.length)
    return <p className="rounded-xl border border-dashed border-line p-10 text-center text-sm text-muted">Nada foi excluído ainda.</p>;

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setSoPendentes((v) => !v)}
        className={cn(
          "rounded-lg border px-3 py-2 text-sm",
          soPendentes ? "border-accent/50 bg-accent/10 text-accent" : "border-line bg-card text-muted",
        )}
      >
        {soPendentes ? "Só o que dá para voltar" : "Todas as exclusões"}
      </button>
      <div className="overflow-x-auto rounded-xl border border-line bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-line text-left">
            <tr>
              {ORDEM.map((o) => (
                <ThOrdem key={o.id} rotulo={o.rotulo} col={o.id} {...ord} className="px-3 py-2" />
              ))}
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {ord.ordenados.map((e) => {
              const [selo, cor] = SELO[e.sit];
              const detalhe =
                e.tipo === "definitiva"
                  ? `com ${e.resumo.entradas ?? 0} entrada(s), ${formatGrams(e.resumo.estoque_dg ?? 0)} em estoque`
                  : "mandado para a Lixeira";
              return (
                <tr key={e.id} className="border-b border-line/60 last:border-0">
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-muted">{formatDataHora(e.em)}</td>
                  <td className="px-3 py-2.5">
                    {e.sit === "restaurado" ? (
                      <Link href={`/produtos/${e.registro_id}`} className="font-medium hover:underline">
                        {e.nome}
                      </Link>
                    ) : (
                      <span className="font-medium">{e.nome}</span>
                    )}
                    <div className="text-[11px] text-muted">Produto · {detalhe}</div>
                  </td>
                  <td className="px-3 py-2.5 text-xs">{e.tipo === "definitiva" ? "Excluído de vez" : "Lixeira"}</td>
                  <td className="px-3 py-2.5">
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px]", cor)}>{selo}</span>
                    {e.sit === "restaurado" && e.restaurado_em && (
                      <div className="mt-0.5 text-[11px] text-faint">{formatDataHora(e.restaurado_em)}</div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Voltar e={e} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
