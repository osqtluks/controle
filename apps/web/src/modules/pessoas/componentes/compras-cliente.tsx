"use client";

import Link from "next/link";
import { formatBRL, formatGrams, type CompraCliente } from "@ct/core";
import { useOrdenacao, type OpcaoOrdem } from "@/components/ui/ordenacao";
import { cn } from "@/lib/cn";
import { formatDataHora } from "@/lib/datas";

const gramas = (c: CompraCliente) => c.itens.reduce((s, i) => s + i.dg, 0);
const ORDEM: OpcaoOrdem<CompraCliente>[] = [
  { id: "data", rotulo: "Data", valor: (c) => c.em, padrao: "desc" },
  { id: "itens", rotulo: "Itens", valor: (c) => c.itens.map((i) => i.produto).join(", ") },
  { id: "gramas", rotulo: "Gramas", valor: gramas, padrao: "desc" },
  { id: "total", rotulo: "Total", valor: (c) => c.totalCents, padrao: "desc" },
];

/** Compras do cliente (com brindes), em tabela ordenável. */
export function ComprasCliente({ compras }: { compras: CompraCliente[] }) {
  const ord = useOrdenacao(compras, ORDEM, "data");
  if (!compras.length) return <p className="text-sm text-muted">Nenhuma compra ainda.</p>;
  const seta = (id: string) => (ord.id === id ? (ord.dir === "asc" ? " ↑" : " ↓") : "");
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-sm">
        <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-faint">
          <tr>
            {ORDEM.map((o) => (
              <th key={o.id} className={cn("px-2 py-2", (o.id === "gramas" || o.id === "total") && "text-right")}>
                <button type="button" onClick={() => ord.alternar(o.id)} className="uppercase hover:text-fg">
                  {o.rotulo}
                  {seta(o.id)}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line/60">
          {ord.ordenados.map((c) => (
            <tr key={c.id} className="hover:bg-hover">
              <td className="whitespace-nowrap px-2 py-2">
                <Link href={`/vendas/${c.id}`} className="hover:underline">
                  {formatDataHora(c.em)}
                </Link>
              </td>
              <td className="px-2 py-2">
                {c.brinde && (
                  <span className="mr-1 rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">BRINDE</span>
                )}
                {c.itens.map((i) => i.produto).join(", ")}
              </td>
              <td className="px-2 py-2 text-right tabular-nums">{formatGrams(gramas(c))}</td>
              <td className="px-2 py-2 text-right tabular-nums">{c.brinde ? "—" : formatBRL(c.totalCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
