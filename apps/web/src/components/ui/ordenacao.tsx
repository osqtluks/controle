"use client";

import { useMemo, useState } from "react";
import { ArrowDownWideNarrow, ArrowUpNarrowWide } from "lucide-react";
import { ordenar, type Direcao } from "@ct/core";

type Valor = string | number | boolean | null | undefined | Date;

export interface OpcaoOrdem<T> {
  id: string;
  rotulo: string;
  valor: (x: T) => Valor;
  /** Direção inicial ao escolher esta opção (ex.: valores começam do maior). */
  padrao?: Direcao;
}

/** Estado de ordenação reutilizável em qualquer lista/tabela. */
export function useOrdenacao<T>(itens: readonly T[], opcoes: OpcaoOrdem<T>[], inicial: string) {
  const [id, setId] = useState(inicial);
  const opcao = opcoes.find((o) => o.id === id) ?? opcoes[0]!;
  const [dir, setDir] = useState<Direcao>(opcao.padrao ?? "asc");
  const ordenados = useMemo(() => ordenar(itens, opcao.valor, dir), [itens, opcao, dir]);

  function escolher(novo: string) {
    const o = opcoes.find((x) => x.id === novo);
    setId(novo);
    setDir(o?.padrao ?? "asc");
  }
  /** Para cabeçalho de tabela: clicar de novo inverte. */
  function alternar(novo: string) {
    if (novo === id) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else escolher(novo);
  }
  return { ordenados, id, dir, escolher, alternar, setDir };
}

export function ControleOrdem<T>({
  opcoes,
  id,
  dir,
  escolher,
  setDir,
}: {
  opcoes: OpcaoOrdem<T>[];
  id: string;
  dir: Direcao;
  escolher: (id: string) => void;
  setDir: (d: Direcao) => void;
}) {
  const Icone = dir === "asc" ? ArrowUpNarrowWide : ArrowDownWideNarrow;
  return (
    <div className="flex items-center gap-1">
      <select
        aria-label="Ordenar por"
        value={id}
        onChange={(e) => escolher(e.target.value)}
        className="rounded-lg border border-line bg-card px-2.5 py-2 text-sm outline-none focus:border-accent"
      >
        {opcoes.map((o) => (
          <option key={o.id} value={o.id}>
            {o.rotulo}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => setDir(dir === "asc" ? "desc" : "asc")}
        title={dir === "asc" ? "Crescente (toque para inverter)" : "Decrescente (toque para inverter)"}
        className="rounded-lg border border-line bg-card p-2 text-muted hover:text-fg"
      >
        <Icone size={18} />
      </button>
    </div>
  );
}

/** Cabeçalho de coluna clicável para tabelas. */
export function ThOrdem({
  rotulo,
  col,
  id,
  dir,
  alternar,
  className,
}: {
  rotulo: string;
  col: string;
  id: string;
  dir: Direcao;
  alternar: (col: string) => void;
  className?: string;
}) {
  const ativo = col === id;
  return (
    <th className={className} aria-sort={ativo ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        onClick={() => alternar(col)}
        className={`inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wide ${ativo ? "text-fg" : "text-faint hover:text-muted"}`}
      >
        {rotulo}
        <span className="w-3">{ativo ? (dir === "asc" ? "▲" : "▼") : ""}</span>
      </button>
    </th>
  );
}
