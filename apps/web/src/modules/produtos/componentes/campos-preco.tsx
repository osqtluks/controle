"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import {
  formatBps,
  formatLucro,
  margemBps,
  MAX_FAIXAS,
  parseBRL,
  parseGrams,
  PRESETS_FAIXAS,
  type TabelaPreco,
} from "@ct/core";
import { Input } from "@/components/ui/form";
import { cn } from "@/lib/cn";

export const centsParaTexto = (c: number | null | undefined) =>
  c === null || c === undefined ? "" : (c / 100).toFixed(2).replace(".", ",");

const dgParaTexto = (dg: number) => String(dg / 10).replace(".", ",");

export interface PrecosIniciais {
  custo: number | null;
  faixas: TabelaPreco;
}

interface LinhaFaixa {
  chave: number;
  g: string;
  preco: string;
}

/**
 * Pago por grama + faixas de venda personalizadas (1 a 6): "a partir de X g → R$ Y/g".
 * Envia `custo_ref` e `faixas` (JSON [{g, preco}] em texto, validado no servidor).
 */
export function CamposPreco({ iniciais }: { iniciais: PrecosIniciais }) {
  const [custo, setCusto] = useState(centsParaTexto(iniciais.custo));
  const [seq, setSeq] = useState(100);
  const [linhas, setLinhas] = useState<LinhaFaixa[]>(() =>
    (iniciais.faixas.length ? iniciais.faixas : [{ minDg: 30, precoCents: 0 }]).map((f, i) => ({
      chave: i,
      g: dgParaTexto(f.minDg),
      preco: f.precoCents ? centsParaTexto(f.precoCents) : "",
    })),
  );

  const c = parseBRL(custo);

  function aplicarPreset(gs: number[]) {
    // Mantém os preços que já existiam nas mesmas posições.
    setLinhas((ls) => gs.map((g, i) => ({ chave: seq + i, g: String(g).replace(".", ","), preco: ls[i]?.preco ?? "" })));
    setSeq((s) => s + gs.length);
  }

  function adicionar() {
    const ultimo = parseGrams(linhas[linhas.length - 1]?.g ?? "") ?? 0;
    setLinhas((ls) => [...ls, { chave: seq, g: ultimo ? dgParaTexto(ultimo * 2) : "", preco: "" }]);
    setSeq((s) => s + 1);
  }

  const ordenadas = [...linhas].sort((a, b) => (parseGrams(a.g) ?? 1e9) - (parseGrams(b.g) ?? 1e9));
  const valores = linhas.map((l) => parseGrams(l.g));
  const repetidas = new Set(valores.filter((v, i) => v !== null && valores.indexOf(v) !== i));
  const json = JSON.stringify(ordenadas.map((l) => ({ g: l.g, preco: l.preco })));

  return (
    <div className="space-y-3">
      <input type="hidden" name="faixas" value={json} />
      <label className="block max-w-[50%] space-y-1">
        <span className="text-sm font-medium text-muted">Pago por grama (R$)</span>
        <Input name="custo_ref" inputMode="decimal" placeholder="0,00" value={custo} onChange={(e) => setCusto(e.target.value)} />
      </label>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium text-muted">Vendo por grama, conforme a quantidade</span>
          <div className="flex flex-wrap gap-1">
            {PRESETS_FAIXAS.map((p) => (
              <button
                key={p.join("-")}
                type="button"
                onClick={() => aplicarPreset(p)}
                className="rounded-md border border-line px-2 py-1 text-[11px] text-muted hover:bg-hover hover:text-fg"
                title="Usar essas faixas"
              >
                {p.join(" · ")} g
              </button>
            ))}
          </div>
        </div>

        {linhas.map((l, i) => {
          const dg = parseGrams(l.g);
          const v = parseBRL(l.preco);
          const lucro = c !== null && v !== null ? v - c : null;
          const margem = c !== null && v !== null ? margemBps(v, c) : null;
          const repetida = dg !== null && repetidas.has(dg);
          return (
            <div key={l.chave} className="grid grid-cols-[1fr_1fr_auto] items-start gap-2">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-faint">a partir de</span>
                <Input
                  inputMode="decimal"
                  value={l.g}
                  onChange={(e) => setLinhas((ls) => ls.map((x) => (x.chave === l.chave ? { ...x, g: e.target.value } : x)))}
                  className={cn("pl-[5.5rem] pr-7 text-base font-semibold", l.g && (dg === null || repetida) && "border-red-500")}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-faint">g</span>
              </div>
              <div>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-faint">R$</span>
                  <Input
                    inputMode="decimal"
                    required={i === 0}
                    value={l.preco}
                    placeholder="0,00"
                    onChange={(e) => setLinhas((ls) => ls.map((x) => (x.chave === l.chave ? { ...x, preco: e.target.value } : x)))}
                    className="pl-9 pr-8 text-base font-semibold"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-faint">/g</span>
                </div>
                {lucro !== null && (
                  <span className={cn("mt-0.5 block text-xs", lucro > 0 ? "text-emerald-400" : lucro < 0 ? "text-red-400" : "text-muted")}>
                    {formatLucro(lucro)}/g{lucro < 0 ? " (prejuízo)" : ""}
                    {margem !== null ? ` · ${formatBps(margem)}` : ""}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setLinhas((ls) => ls.filter((x) => x.chave !== l.chave))}
                disabled={linhas.length === 1}
                aria-label="Tirar faixa"
                className="mt-2.5 p-1 text-faint hover:text-red-400 disabled:opacity-30"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}

        {linhas.length < MAX_FAIXAS && (
          <button
            type="button"
            onClick={adicionar}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-2 text-xs text-muted hover:border-accent/50 hover:text-fg"
          >
            <Plus size={14} /> Adicionar faixa ({linhas.length}/{MAX_FAIXAS})
          </button>
        )}
        {repetidas.size > 0 && <p className="text-xs text-red-400">Duas faixas com a mesma quantidade.</p>}
        <p className="text-[11px] text-faint">Quem leva menos que a primeira faixa paga o preço da primeira.</p>
      </div>
    </div>
  );
}
