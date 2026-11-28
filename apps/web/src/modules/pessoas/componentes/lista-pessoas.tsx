"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Gift, Trophy } from "lucide-react";
import { BRINDE_NA_COMPRA_DO_MES, formatBps, formatBRL, ROTULO_STATUS, type BrindeDoMes, type PerfilCliente } from "@ct/core";
import { ControleOrdem, useOrdenacao, type OpcaoOrdem } from "@/components/ui/ordenacao";
import { cn } from "@/lib/cn";
import { COR_STATUS, TIPO_PESSOA, type Pessoa } from "../tipos";

export type ResumoPessoa = Pessoa & {
  perfil: PerfilCliente;
  brinde: BrindeDoMes;
  posicao: number | null;
  indicou: number;
  bonusBps: number;
  indicadoPorNome: string | null;
};

const ORDEM: OpcaoOrdem<ResumoPessoa>[] = [
  { id: "nome", rotulo: "Nome", valor: (p) => p.nome },
  { id: "ultima", rotulo: "Última compra", valor: (p) => p.perfil.ultima, padrao: "desc" },
  { id: "gasto", rotulo: "Quanto já gastou", valor: (p) => p.perfil.gastoCents, padrao: "desc" },
  { id: "compras", rotulo: "Nº de compras", valor: (p) => p.perfil.compras, padrao: "desc" },
  { id: "mes", rotulo: "Compras no mês", valor: (p) => p.perfil.comprasNoMes, padrao: "desc" },
  { id: "indicou", rotulo: "Quem mais indicou", valor: (p) => p.indicou, padrao: "desc" },
  { id: "parado", rotulo: "Dias sem comprar", valor: (p) => p.perfil.diasSemComprar, padrao: "desc" },
  { id: "criado", rotulo: "Cadastro mais recente", valor: (p) => p.created_at, padrao: "desc" },
];

const FILTROS = [
  { id: "", rotulo: "Todos" },
  { id: "cliente", rotulo: "Clientes" },
  { id: "fornecedor", rotulo: "Fornecedores" },
] as const;

const LETRAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const letraDe = (nome: string) => {
  const l = nome.trim().normalize("NFD").replace(/[̀-ͯ]/g, "").charAt(0).toUpperCase();
  return /[A-Z]/.test(l) ? l : "#";
};

/** Bolinhas de progresso até o brinde do mês. */
export function ProgressoBrinde({ b }: { b: BrindeDoMes }) {
  return (
    <span className="inline-flex items-center gap-1" title={`${b.comprasNoMes} compra(s) no mês`}>
      {Array.from({ length: BRINDE_NA_COMPRA_DO_MES }, (_, i) => (
        <span key={i} className={cn("size-2 rounded-full", i < b.comprasNoMes ? "bg-amber-400" : "bg-white/15")} />
      ))}
      <Gift size={13} className={cn(b.ganhou ? (b.entregue ? "text-emerald-400" : "text-amber-400") : "text-faint")} />
    </span>
  );
}

function diasTexto(d: number | null) {
  if (d === null) return "nunca comprou";
  if (d === 0) return "comprou hoje";
  if (d === 1) return "comprou ontem";
  return `comprou há ${d} dias`;
}

export function ListaPessoas({ pessoas }: { pessoas: ResumoPessoa[] }) {
  const [filtro, setFiltro] = useState<"" | "cliente" | "fornecedor">("");
  const [letra, setLetra] = useState("");
  const [busca, setBusca] = useState("");

  const doTipo = useMemo(
    () => (filtro ? pessoas.filter((p) => p.tipo === filtro || p.tipo === "ambos") : pessoas),
    [pessoas, filtro],
  );
  const comLetra = useMemo(() => new Set(doTipo.map((p) => letraDe(p.nome))), [doTipo]);
  const visiveis = useMemo(() => {
    const b = busca.trim().toLocaleLowerCase("pt-BR");
    return doTipo
      .filter((p) => !letra || letraDe(p.nome) === letra)
      .filter((p) => !b || `${p.nome} ${p.apelido ?? ""} ${p.telefone ?? ""}`.toLocaleLowerCase("pt-BR").includes(b));
  }, [doTipo, letra, busca]);
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
      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por nome, apelido ou telefone…"
        className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm outline-none focus:border-accent"
      />
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => setLetra("")}
          className={cn("rounded-md px-2 py-1 text-xs", !letra ? "bg-accent font-semibold text-black" : "text-muted hover:bg-hover")}
        >
          Todas
        </button>
        {[...LETRAS, "#"].map((l) => (
          <button
            key={l}
            type="button"
            disabled={!comLetra.has(l)}
            onClick={() => setLetra(l === letra ? "" : l)}
            className={cn(
              "min-w-7 rounded-md px-1.5 py-1 text-xs font-medium",
              letra === l ? "bg-accent text-black" : "text-fg hover:bg-hover",
              "disabled:text-faint/40 disabled:hover:bg-transparent",
            )}
          >
            {l}
          </button>
        ))}
      </div>

      {ord.ordenados.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">Ninguém por aqui.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {ord.ordenados.map((p) => {
            const cliente = p.tipo !== "fornecedor";
            return (
              <li key={p.id}>
                <Link href={`/pessoas/${p.id}`} className="block h-full rounded-xl border border-line bg-card p-4 hover:border-accent/40">
                  <div className="flex items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-500/30 to-violet-500/30 text-sm font-bold">
                      {letraDe(p.nome)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold">{p.nome}</span>
                        {p.posicao && p.posicao <= 3 && (
                          <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                            <Trophy size={10} /> Top {p.posicao}
                          </span>
                        )}
                      </div>
                      <div className="truncate text-xs text-muted">
                        {[p.apelido && `“${p.apelido}”`, p.telefone].filter(Boolean).join(" · ") || TIPO_PESSOA[p.tipo]}
                      </div>
                    </div>
                    {cliente ? (
                      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px]", COR_STATUS[p.perfil.status])}>
                        {ROTULO_STATUS[p.perfil.status]}
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-sky-500/15 px-2 py-0.5 text-[11px] text-sky-300">Fornecedor</span>
                    )}
                  </div>
                  {cliente && (
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg bg-bg/60 p-1.5">
                        <div className="text-[10px] text-faint">Compras</div>
                        <div className="text-sm font-semibold tabular-nums">{p.perfil.compras}</div>
                      </div>
                      <div className="rounded-lg bg-bg/60 p-1.5">
                        <div className="text-[10px] text-faint">Gastou</div>
                        <div className="truncate text-sm font-semibold tabular-nums">{formatBRL(p.perfil.gastoCents)}</div>
                      </div>
                      <div className="rounded-lg bg-bg/60 p-1.5">
                        <div className="text-[10px] text-faint">No mês</div>
                        <div className="flex justify-center pt-1">
                          <ProgressoBrinde b={p.brinde} />
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
                    {cliente && <span>{diasTexto(p.perfil.diasSemComprar)}</span>}
                    {p.indicou > 0 && (
                      <span className="text-violet-300">
                        indicou {p.indicou}
                        {p.bonusBps > 0 && ` · bônus ${formatBps(p.bonusBps)}`}
                      </span>
                    )}
                    {p.indicadoPorNome && <span>indicado por {p.indicadoPorNome}</span>}
                    {p.brinde.ganhou && !p.brinde.entregue && <span className="font-semibold text-amber-300">brinde pendente!</span>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
