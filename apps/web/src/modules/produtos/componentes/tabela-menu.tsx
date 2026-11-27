"use client";

import { useActionState, useMemo, useState } from "react";
import { Check, ImageOff, Pencil } from "lucide-react";
import {
  FAIXAS,
  formatBRL,
  formatGrams,
  precosEfetivos,
  priceFor,
  stockLevel,
  type FaixaId,
} from "@ct/core";
import { ControleOrdem, ThOrdem, useOrdenacao, type OpcaoOrdem } from "@/components/ui/ordenacao";
import { cn } from "@/lib/cn";
import { atualizarPrecos, type EstadoForm } from "../acoes";
import { limitesDe, tabelaDe } from "../tipos";
import { centsParaTexto } from "./campos-preco";
import type { ProdutoCardDados } from "./card";

const faixa = (id: FaixaId) => (p: ProdutoCardDados) => precosEfetivos(tabelaDe(p))[id];

const ORDEM: OpcaoOrdem<ProdutoCardDados>[] = [
  { id: "nome", rotulo: "Produto", valor: (p) => p.nome },
  { id: "categoria", rotulo: "Categoria", valor: (p) => p.categoria },
  { id: "base", rotulo: "3 g+", valor: faixa("base"), padrao: "desc" },
  { id: "de10", rotulo: "10 g+", valor: faixa("de10"), padrao: "desc" },
  { id: "de30", rotulo: "30 g+", valor: faixa("de30"), padrao: "desc" },
  { id: "estoque", rotulo: "Estoque", valor: (p) => p.estoque_dg, padrao: "desc" },
];

const inputCel =
  "w-full min-w-16 rounded-md border border-line bg-bg px-2 py-1.5 text-right text-sm tabular-nums outline-none focus:border-accent";

/** Linha em modo edição: inputs ligados a um <form> fora da tabela (form="..."). */
function LinhaEdicao({ p }: { p: ProdutoCardDados }) {
  const [estado, acao, enviando] = useActionState<EstadoForm, FormData>(atualizarPrecos, {});
  const fid = `menu-${p.id}`;
  const ef = precosEfetivos(tabelaDe(p));
  return (
    <tr className="border-b border-line/60">
      <td className="px-2 py-2">
        <div className="font-medium">{p.nome}</div>
        {estado.erro && <div className="text-[11px] text-red-400">{estado.erro}</div>}
      </td>
      <td className="px-2 py-2">
        <input form={fid} name="custo_ref" inputMode="decimal" defaultValue={centsParaTexto(p.custo_ref_cents_por_grama)} placeholder="—" className={inputCel} />
      </td>
      <td className="px-2 py-2">
        <input form={fid} name="preco" required inputMode="decimal" defaultValue={centsParaTexto(p.preco_cents_por_grama)} className={inputCel} />
      </td>
      <td className="px-2 py-2">
        <input form={fid} name="preco_10g" inputMode="decimal" defaultValue={centsParaTexto(p.preco_10g_cents_por_grama)} placeholder={centsParaTexto(ef.de10)} className={inputCel} />
      </td>
      <td className="px-2 py-2">
        <input form={fid} name="preco_30g" inputMode="decimal" defaultValue={centsParaTexto(p.preco_30g_cents_por_grama)} placeholder={centsParaTexto(ef.de30)} className={inputCel} />
      </td>
      <td className="px-2 py-2 text-right">
        <form id={fid} action={acao}>
          <input type="hidden" name="id" value={p.id} />
          <button
            disabled={enviando}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold",
              estado.ok ? "bg-emerald-500/15 text-emerald-300" : "bg-accent text-black",
            )}
          >
            {estado.ok && !enviando ? <Check size={14} /> : null}
            {enviando ? "…" : estado.ok ? "Salvo" : "Salvar"}
          </button>
        </form>
      </td>
    </tr>
  );
}

export function TabelaMenu({ produtos }: { produtos: ProdutoCardDados[] }) {
  const [editando, setEditando] = useState(false);
  const [soComEstoque, setSoComEstoque] = useState(true);
  const visiveis = useMemo(
    () => (soComEstoque ? produtos.filter((p) => stockLevel(p.estoque_dg, limitesDe(p)) !== "acabou") : produtos),
    [produtos, soComEstoque],
  );
  const ord = useOrdenacao(visiveis, ORDEM, "nome");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSoComEstoque((v) => !v)}
            className={cn(
              "rounded-lg border px-3 py-2 text-sm",
              soComEstoque ? "border-accent/50 bg-accent/10 text-accent" : "border-line bg-card text-muted",
            )}
          >
            {soComEstoque ? "Só com estoque" : "Todos os produtos"}
          </button>
          <button
            type="button"
            onClick={() => setEditando((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm",
              editando ? "border-orange-500/50 bg-orange-500/10 text-orange-300" : "border-line bg-card text-muted",
            )}
          >
            <Pencil size={14} /> {editando ? "Concluir edição" : "Editar preços"}
          </button>
        </div>
        {!editando && <ControleOrdem opcoes={ORDEM} {...ord} />}
      </div>

      {ord.ordenados.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">Nada para mostrar.</p>
      ) : editando ? (
        <div className="overflow-x-auto rounded-xl border border-line bg-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-faint">
              <tr>
                <th className="px-2 py-2">Produto</th>
                <th className="px-2 py-2 text-right">Pago/g</th>
                <th className="px-2 py-2 text-right text-fg">3 g+</th>
                <th className="px-2 py-2 text-right text-fg">10 g+</th>
                <th className="px-2 py-2 text-right text-fg">30 g+</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {ord.ordenados.map((p) => (
                <LinhaEdicao key={p.id} p={p} />
              ))}
            </tbody>
          </table>
          <p className="px-3 py-2 text-[11px] text-faint">Valores em R$ por grama. Faixa em branco usa a anterior.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-card">
          <table className="w-full min-w-[560px]">
            <thead className="border-b border-line text-left">
              <tr>
                <ThOrdem rotulo="Produto" col="nome" {...ord} className="px-3 py-3" />
                {FAIXAS.map((f) => (
                  <ThOrdem key={f.id} rotulo={f.rotulo} col={f.id} {...ord} className="px-3 py-3 text-right" />
                ))}
              </tr>
            </thead>
            <tbody>
              {ord.ordenados.map((p) => {
                const ef = precosEfetivos(tabelaDe(p));
                const nivel = stockLevel(p.estoque_dg, limitesDe(p));
                return (
                  <tr key={p.id} className="border-b border-line/60 last:border-0">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <div className="size-10 shrink-0 overflow-hidden rounded-lg bg-hover">
                          {p.foto_url ? (
                            // eslint-disable-next-line @next/next/no-img-element -- URL assinada temporária
                            <img src={p.foto_url} alt="" className="size-full object-cover" />
                          ) : (
                            <div className="flex size-full items-center justify-center text-faint">
                              <ImageOff size={16} />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-medium">{p.nome}</div>
                          <div className="truncate text-[11px] text-muted">
                            {p.categoria ?? ""}
                            {nivel === "acabou" ? " · sem estoque" : ` · ${formatGrams(p.estoque_dg)}`}
                          </div>
                        </div>
                      </div>
                    </td>
                    {FAIXAS.map((f) => (
                      <td key={f.id} className="px-3 py-3 text-right">
                        <div className="text-base font-semibold tabular-nums">{formatBRL(ef[f.id])}<span className="text-xs font-normal text-faint">/g</span></div>
                        <div className="text-[11px] tabular-nums text-muted">
                          {formatGrams(f.exemploDg)} = {formatBRL(priceFor(f.exemploDg, ef[f.id]))}
                        </div>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
