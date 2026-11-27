"use client";

import { useState } from "react";
import { formatBRL, formatBps, margemBps, parseBRL } from "@ct/core";
import { Input } from "@/components/ui/form";
import { cn } from "@/lib/cn";

export const centsParaTexto = (c: number | null | undefined) =>
  c === null || c === undefined ? "" : (c / 100).toFixed(2).replace(".", ",");

export interface PrecosIniciais {
  custo: number | null;
  base: number | null;
  de10: number | null;
  de30: number | null;
}

/**
 * Pago por grama + Vendo por grama em 3 faixas (3 g+, 10 g+, 30 g+), com lucro ao vivo.
 * Campos enviados: custo_ref, preco, preco_10g, preco_30g. Faixa vazia herda a de baixo.
 */
export function CamposPreco({ iniciais, compacto }: { iniciais: PrecosIniciais; compacto?: boolean }) {
  const [custo, setCusto] = useState(centsParaTexto(iniciais.custo));
  const [base, setBase] = useState(centsParaTexto(iniciais.base));
  const [de10, setDe10] = useState(centsParaTexto(iniciais.de10));
  const [de30, setDe30] = useState(centsParaTexto(iniciais.de30));

  const c = parseBRL(custo);
  const vBase = parseBRL(base);
  const v10 = parseBRL(de10) ?? vBase;
  const v30 = parseBRL(de30) ?? v10;

  const faixas = [
    { nome: "preco", rotulo: "3 g+", valor: base, set: setBase, efetivo: vBase, req: true },
    { nome: "preco_10g", rotulo: "10 g+", valor: de10, set: setDe10, efetivo: v10, req: false },
    { nome: "preco_30g", rotulo: "30 g+", valor: de30, set: setDe30, efetivo: v30, req: false },
  ];

  return (
    <div className="space-y-3">
      <label className="block max-w-[50%] space-y-1">
        <span className="text-xs font-medium text-muted">Pago por grama (R$)</span>
        <Input name="custo_ref" inputMode="decimal" placeholder="0,00" value={custo} onChange={(e) => setCusto(e.target.value)} />
      </label>
      <div>
        <span className="text-xs font-medium text-muted">Vendo por grama (R$)</span>
        <div className="mt-1 grid grid-cols-3 gap-2">
          {faixas.map((f) => {
            const lucro = c !== null && f.efetivo !== null ? f.efetivo - c : null;
            const margem = c !== null && f.efetivo !== null ? margemBps(f.efetivo, c) : null;
            return (
              <label key={f.nome} className="block space-y-1">
                <span className="text-[11px] font-semibold text-fg">
                  {f.rotulo}
                  {f.req && " *"}
                </span>
                <Input
                  name={f.nome}
                  required={f.req}
                  inputMode="decimal"
                  placeholder={f.req ? "0,00" : centsParaTexto(f.efetivo) || "igual"}
                  value={f.valor}
                  onChange={(e) => f.set(e.target.value)}
                />
                {!compacto && lucro !== null && (
                  <span className={cn("block text-[11px]", lucro < 0 ? "text-red-400" : "text-emerald-400")}>
                    +{formatBRL(lucro)}/g{margem !== null ? ` · ${formatBps(margem)}` : ""}
                  </span>
                )}
              </label>
            );
          })}
        </div>
        <p className="mt-1 text-[11px] text-faint">Faixa em branco usa o preço da faixa anterior.</p>
      </div>
    </div>
  );
}
