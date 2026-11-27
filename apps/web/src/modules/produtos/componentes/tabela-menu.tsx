"use client";

import { useMemo, useState } from "react";
import { ImageOff, Pencil } from "lucide-react";
import { formatBRL, formatGrams, ordenarFaixas, priceFor, rotuloFaixa, stockLevel } from "@ct/core";
import { ControleOrdem, useOrdenacao, type OpcaoOrdem } from "@/components/ui/ordenacao";
import { cn } from "@/lib/cn";
import { limitesDe, tabelaDe } from "../tipos";
import type { ProdutoCardDados } from "./card";
import { EditarPrecos } from "./editar-precos";

const menorPreco = (p: ProdutoCardDados) => Math.min(...tabelaDe(p).map((f) => f.precoCents));

const ORDEM: OpcaoOrdem<ProdutoCardDados>[] = [
  { id: "nome", rotulo: "Produto", valor: (p) => p.nome },
  { id: "categoria", rotulo: "Categoria", valor: (p) => p.categoria },
  { id: "preco", rotulo: "Preço inicial", valor: (p) => p.preco_cents_por_grama, padrao: "desc" },
  { id: "menor", rotulo: "Menor preço", valor: menorPreco },
  { id: "estoque", rotulo: "Estoque", valor: (p) => p.estoque_dg, padrao: "desc" },
];

function Foto({ url }: { url: string | null }) {
  return (
    <div className="size-12 shrink-0 overflow-hidden rounded-lg bg-hover">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- URL assinada temporária
        <img src={url} alt="" className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center text-faint">
          <ImageOff size={16} />
        </div>
      )}
    </div>
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
        <ControleOrdem opcoes={ORDEM} {...ord} />
      </div>

      {ord.ordenados.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">Nada para mostrar.</p>
      ) : (
        <div className="space-y-3">
          {ord.ordenados.map((p) => {
            const faixas = ordenarFaixas(tabelaDe(p));
            const semEstoque = stockLevel(p.estoque_dg, limitesDe(p)) === "acabou";
            return (
              <section key={p.id} className="rounded-xl border border-line bg-card p-4">
                <div className="mb-3 flex items-center gap-3">
                  <Foto url={p.foto_url} />
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-semibold">{p.nome}</h3>
                    <p className="text-xs text-muted">
                      {p.categoria ? `${p.categoria} · ` : ""}
                      {semEstoque ? "sem estoque" : `${formatGrams(p.estoque_dg)} disponíveis`}
                    </p>
                  </div>
                </div>
                {editando ? (
                  <EditarPrecos id={p.id} tabela={faixas} custo={p.custo_ref_cents_por_grama} inicialAberto />
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                    {faixas.map((f) => (
                      <div key={f.minDg} className="rounded-lg bg-bg/60 px-3 py-2">
                        <div className="text-sm font-semibold text-accent">{rotuloFaixa(f.minDg)}</div>
                        <div className="text-xl font-bold tabular-nums">
                          {formatBRL(f.precoCents)}
                          <span className="text-xs font-normal text-faint">/g</span>
                        </div>
                        <div className="text-[11px] tabular-nums text-muted">
                          {formatGrams(f.minDg)} = {formatBRL(priceFor(f.minDg, f.precoCents))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
