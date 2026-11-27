"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { descreverPrazo, diasEntre, formatBRL, situacaoDe, type InfoSituacao } from "@ct/core";
import { ThOrdem, useOrdenacao, type OpcaoOrdem } from "@/components/ui/ordenacao";
import { cn } from "@/lib/cn";
import { formatData, hojeISO } from "@/lib/datas";
import { COR_SITUACAO, type Conta } from "../tipos";

type Linha = Conta & { info: InfoSituacao; idade: number };

/** Ordem de urgência para "mais atrasado primeiro". */
const PESO = { atrasada: 0, vence_logo: 1, em_dia: 2, sem_data: 3, quitada: 4, cancelada: 5 } as const;

const ORDEM: OpcaoOrdem<Linha>[] = [
  { id: "situacao", rotulo: "Situação", valor: (c) => PESO[c.info.situacao] * 100000 - (c.info.dias ?? 0) },
  { id: "pessoa", rotulo: "Pessoa", valor: (c) => c.pessoa?.nome },
  { id: "descricao", rotulo: "Descrição", valor: (c) => c.descricao },
  { id: "falta", rotulo: "Falta", valor: (c) => c.restante_cents, padrao: "desc" },
  { id: "total", rotulo: "Valor", valor: (c) => c.valor_total_cents, padrao: "desc" },
  { id: "vencimento", rotulo: "Vencimento", valor: (c) => c.proximo_vencimento },
  { id: "remarcada", rotulo: "Remarcada", valor: (c) => c.dias_remarcados, padrao: "desc" },
  { id: "idade", rotulo: "Idade", valor: (c) => c.idade, padrao: "desc" },
];

export function SeloSituacao({ info }: { info: InfoSituacao }) {
  const cor = COR_SITUACAO[info.situacao];
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium", cor.selo)}>
      <span className={cn("size-1.5 rounded-full", cor.ponto)} />
      {info.situacao === "em_dia" || info.situacao === "vence_logo" || info.situacao === "atrasada"
        ? descreverPrazo(info)
        : cor.rotulo}
    </span>
  );
}

export function ListaContas({ contas }: { contas: Conta[] }) {
  const hoje = hojeISO();
  const [tipo, setTipo] = useState<"todas" | "receber" | "pagar">("todas");
  const [estado, setEstado] = useState<"abertas" | "quitadas" | "canceladas">("abertas");
  const [busca, setBusca] = useState("");

  const linhas: Linha[] = useMemo(
    () =>
      contas.map((c) => ({
        ...c,
        info: situacaoDe(c.restante_cents, c.proximo_vencimento, hoje, undefined, !!c.cancelada_em),
        idade: diasEntre(c.created_at.slice(0, 10), hoje),
      })),
    [contas, hoje],
  );

  const abertas = linhas.filter((c) => !c.cancelada_em && c.restante_cents > 0);
  const resumo = (t: "receber" | "pagar") => {
    const xs = abertas.filter((c) => c.tipo === t);
    const atras = xs.filter((c) => c.info.situacao === "atrasada");
    return {
      total: xs.reduce((s, c) => s + c.restante_cents, 0),
      atrasado: atras.reduce((s, c) => s + c.restante_cents, 0),
      nAtrasadas: atras.length,
      logo: xs.filter((c) => c.info.situacao === "vence_logo").length,
    };
  };
  const rec = resumo("receber");
  const pag = resumo("pagar");

  const filtradas = useMemo(() => {
    const b = busca.trim().toLocaleLowerCase("pt-BR");
    return linhas.filter((c) => {
      if (tipo !== "todas" && c.tipo !== tipo) return false;
      if (estado === "canceladas") { if (!c.cancelada_em) return false; }
      else if (c.cancelada_em) return false;
      else if (estado === "abertas" && c.restante_cents <= 0) return false;
      else if (estado === "quitadas" && c.restante_cents > 0) return false;
      if (b && !`${c.pessoa?.nome ?? ""} ${c.descricao}`.toLocaleLowerCase("pt-BR").includes(b)) return false;
      return true;
    });
  }, [linhas, tipo, estado, busca]);

  const ord = useOrdenacao(filtradas, ORDEM, "situacao");
  const chip = (ativo: boolean) => cn("rounded-md px-3 py-1.5 text-sm", ativo ? "bg-hover font-medium text-fg" : "text-muted");

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2">
        {(
          [
            ["receber", "A receber", rec, "text-emerald-400"],
            ["pagar", "A pagar", pag, "text-sky-300"],
          ] as const
        ).map(([t, rot, r, cor]) => (
          <button
            key={t}
            type="button"
            onClick={() => setTipo(tipo === t ? "todas" : t)}
            className={cn("rounded-xl border bg-card p-4 text-left", tipo === t ? "border-accent/60" : "border-line")}
          >
            <div className="text-xs text-muted">{rot}</div>
            <div className={cn("text-2xl font-semibold tabular-nums", cor)}>{formatBRL(r.total)}</div>
            <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
              {r.nAtrasadas > 0 ? (
                <span className="rounded-full bg-red-500/15 px-2 py-0.5 font-medium text-red-300">
                  {formatBRL(r.atrasado)} atrasado ({r.nAtrasadas})
                </span>
              ) : (
                <span className="text-faint">nada atrasado</span>
              )}
              {r.logo > 0 && <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-orange-300">{r.logo} vence(m) logo</span>}
            </div>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg border border-line bg-card p-1">
          {(["todas", "receber", "pagar"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTipo(t)} className={chip(tipo === t)}>
              {t === "todas" ? "Todas" : t === "receber" ? "A receber" : "A pagar"}
            </button>
          ))}
        </div>
        <div className="flex gap-1 rounded-lg border border-line bg-card p-1">
          {(["abertas", "quitadas", "canceladas"] as const).map((e) => (
            <button key={e} type="button" onClick={() => setEstado(e)} className={chip(estado === e)}>
              {e === "abertas" ? "Em aberto" : e === "quitadas" ? "Quitadas" : "Canceladas"}
            </button>
          ))}
        </div>
        <label className="relative min-w-40 flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar pessoa ou descrição"
            className="w-full rounded-lg border border-line bg-card py-2 pl-9 pr-3 text-sm outline-none focus:border-accent"
          />
        </label>
      </div>

      {filtradas.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-10 text-center text-sm text-muted">Nada aqui.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-card">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="border-b border-line text-left">
              <tr>
                {ORDEM.map((o) => (
                  <ThOrdem key={o.id} rotulo={o.rotulo} col={o.id} {...ord} className="px-3 py-2" />
                ))}
              </tr>
            </thead>
            <tbody>
              {ord.ordenados.map((c) => (
                <tr key={c.id} className={cn("border-b border-line/60 last:border-0 hover:bg-hover/60", COR_SITUACAO[c.info.situacao].linha)}>
                  <td className="px-3 py-2.5">
                    <Link href={`/contas/${c.id}`}>
                      <SeloSituacao info={c.info} />
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <Link href={`/contas/${c.id}`} className="font-medium hover:underline">
                      {c.pessoa?.nome ?? <span className="text-faint">—</span>}
                    </Link>
                    <div className={cn("text-[11px]", c.tipo === "receber" ? "text-emerald-400/80" : "text-sky-300/80")}>
                      {c.tipo === "receber" ? "me deve" : "eu devo"}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <Link href={`/contas/${c.id}`} className="hover:underline">
                      {c.descricao}
                    </Link>
                    {c.parcelas > 1 && (
                      <div className="text-[11px] text-muted">
                        {c.parcelas_pagas}/{c.parcelas} parcelas pagas
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-semibold tabular-nums">{formatBRL(c.restante_cents)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-muted">
                    {formatBRL(c.valor_total_cents)}
                    {c.pago_cents > 0 && <div className="text-[11px] text-emerald-400/80">pago {formatBRL(c.pago_cents)}</div>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">
                    {formatData(c.proximo_vencimento)}
                    {c.dias_remarcados !== 0 && c.proximo_vencimento_original && (
                      <div className="text-[11px] text-faint line-through">{formatData(c.proximo_vencimento_original)}</div>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {c.dias_remarcados > 0 ? (
                      <span className="whitespace-nowrap rounded-full bg-violet-500/15 px-2 py-0.5 text-[11px] font-medium text-violet-300">
                        +{c.dias_remarcados} dias
                      </span>
                    ) : c.dias_remarcados < 0 ? (
                      <span className="text-[11px] text-muted">{c.dias_remarcados} dias</span>
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted">
                    {c.idade === 0 ? "hoje" : `${c.idade} dia${c.idade === 1 ? "" : "s"}`}
                    <div className="text-[10px] text-faint">desde {formatData(c.created_at.slice(0, 10))}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-faint">
        <span className="text-red-400">Vermelho</span>: atrasada · <span className="text-orange-400">laranja</span>: vence em até 3 dias ·{" "}
        <span className="text-emerald-400">verde</span>: em dia · <span className="text-violet-300">roxo</span>: dias que a data foi empurrada
        desde a original. Idade = dias desde que a dívida foi criada.
      </p>
    </div>
  );
}
