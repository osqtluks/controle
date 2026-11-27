"use client";

import { useMemo, useState } from "react";
import { ControleOrdem, useOrdenacao, type OpcaoOrdem } from "@/components/ui/ordenacao";
import { cn } from "@/lib/cn";
import { TIPO_PESSOA, type Pessoa } from "../tipos";

const ORDEM: OpcaoOrdem<Pessoa>[] = [
  { id: "nome", rotulo: "Nome", valor: (p) => p.nome },
  { id: "tipo", rotulo: "Tipo", valor: (p) => TIPO_PESSOA[p.tipo] },
  { id: "criado", rotulo: "Cadastro mais recente", valor: (p) => p.created_at, padrao: "desc" },
];

const FILTROS = [
  { id: "", rotulo: "Todos" },
  { id: "cliente", rotulo: "Clientes" },
  { id: "fornecedor", rotulo: "Fornecedores" },
] as const;

export function ListaPessoas({ pessoas }: { pessoas: Pessoa[] }) {
  const [filtro, setFiltro] = useState<"" | "cliente" | "fornecedor">("");
  const visiveis = useMemo(
    () => (filtro ? pessoas.filter((p) => p.tipo === filtro || p.tipo === "ambos") : pessoas),
    [pessoas, filtro],
  );
  const ord = useOrdenacao(visiveis, ORDEM, "nome");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-lg border border-line bg-card p-1 text-sm">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFiltro(f.id)}
              className={cn("rounded-md px-3 py-1.5", filtro === f.id ? "bg-hover text-fg" : "text-muted")}
            >
              {f.rotulo}
            </button>
          ))}
        </div>
        <ControleOrdem opcoes={ORDEM} {...ord} />
      </div>
      {ord.ordenados.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">
          Ninguém cadastrado ainda.
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line bg-card">
          {ord.ordenados.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate font-medium">{p.nome}</div>
                <div className="truncate text-xs text-muted">{p.telefone ?? p.observacoes ?? ""}</div>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[11px]",
                  p.tipo === "fornecedor" ? "bg-sky-500/15 text-sky-300" : p.tipo === "ambos" ? "bg-violet-500/15 text-violet-300" : "bg-emerald-500/15 text-emerald-300",
                )}
              >
                {TIPO_PESSOA[p.tipo]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
