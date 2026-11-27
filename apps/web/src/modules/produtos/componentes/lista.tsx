"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { NIVEIS_DE_ALERTA, custoPorGrama, priceFor, stockLevel, stockPercent } from "@ct/core";
import { ControleOrdem, useOrdenacao, type OpcaoOrdem } from "@/components/ui/ordenacao";
import { cn } from "@/lib/cn";
import { limitesDe } from "../tipos";
import { ProdutoCard, type ProdutoCardDados } from "./card";

const ORDEM: OpcaoOrdem<ProdutoCardDados>[] = [
  { id: "nivel", rotulo: "Mais perto de acabar", valor: (p) => stockPercent(p.estoque_dg, limitesDe(p)) },
  { id: "nome", rotulo: "Nome", valor: (p) => p.nome },
  { id: "estoque", rotulo: "Estoque (g)", valor: (p) => p.estoque_dg, padrao: "desc" },
  { id: "preco", rotulo: "Preço por grama", valor: (p) => p.preco_cents_por_grama, padrao: "desc" },
  { id: "custo", rotulo: "Custo por grama", valor: (p) => custoPorGrama(p.custo_estoque_cents, p.estoque_dg), padrao: "desc" },
  { id: "valor", rotulo: "Valor em estoque", valor: (p) => priceFor(p.estoque_dg, p.preco_cents_por_grama), padrao: "desc" },
  { id: "vencimento", rotulo: "Próximo pagamento", valor: (p) => p.proximo_vencimento },
  { id: "entrada", rotulo: "Última entrada", valor: (p) => p.ultima_entrada, padrao: "desc" },
  { id: "categoria", rotulo: "Categoria", valor: (p) => p.categoria },
];

export function ListaProdutos({ produtos }: { produtos: ProdutoCardDados[] }) {
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("");
  const [soAlerta, setSoAlerta] = useState(false);

  const categorias = useMemo(
    () => [...new Set(produtos.map((p) => p.categoria).filter(Boolean) as string[])].sort(),
    [produtos],
  );
  const emAlerta = (p: ProdutoCardDados) => NIVEIS_DE_ALERTA.has(stockLevel(p.estoque_dg, limitesDe(p)));
  const qtdAlerta = produtos.filter(emAlerta).length;

  const filtrados = useMemo(() => {
    const b = busca.trim().toLocaleLowerCase("pt-BR");
    return produtos.filter(
      (p) =>
        (!b || p.nome.toLocaleLowerCase("pt-BR").includes(b)) &&
        (!categoria || p.categoria === categoria) &&
        (!soAlerta || emAlerta(p)),
    );
  }, [produtos, busca, categoria, soAlerta]);

  const ord = useOrdenacao(filtrados, ORDEM, "nivel");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-48 flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar produto"
            className="w-full rounded-lg border border-line bg-card py-2 pl-9 pr-3 text-sm outline-none focus:border-accent"
          />
        </label>
        {categorias.length > 0 && (
          <select
            aria-label="Categoria"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="rounded-lg border border-line bg-card px-2.5 py-2 text-sm outline-none focus:border-accent"
          >
            <option value="">Todas as categorias</option>
            {categorias.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        )}
        <button
          type="button"
          onClick={() => setSoAlerta((v) => !v)}
          className={cn(
            "rounded-lg border px-3 py-2 text-sm",
            soAlerta ? "border-orange-500/50 bg-orange-500/15 text-orange-300" : "border-line bg-card text-muted",
          )}
        >
          Repor ({qtdAlerta})
        </button>
        <ControleOrdem opcoes={ORDEM} {...ord} />
      </div>

      {ord.ordenados.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">Nenhum produto encontrado.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {ord.ordenados.map((p) => (
            <ProdutoCard key={p.id} p={p} />
          ))}
        </div>
      )}
    </div>
  );
}
