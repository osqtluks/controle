"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Copy, Power, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { formatBps } from "@ct/core";
import { Botao, Campo, Erro, Input } from "@/components/ui/form";
import { ThOrdem, useOrdenacao, type OpcaoOrdem } from "@/components/ui/ordenacao";
import { cn } from "@/lib/cn";
import { formatData, formatDataHora, hojeISO } from "@/lib/datas";
import { criarCupom, definirCupomAtivo, type EstadoCupom } from "../acoes";
import { gerarCodigo, SELO_CUPOM, situacaoCupom, type Cupom } from "../tipos";

function maisDias(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function FormCupom({ hoje }: { hoje: string }) {
  const [estado, acao, enviando] = useActionState<EstadoCupom, FormData>(criarCupom, {});
  const [codigo, setCodigo] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- gera um código novo ao abrir e depois de salvar
    setCodigo(gerarCodigo());
    if (estado.ok) toast.success("Cupom criado.");
  }, [estado]);

  return (
    <form action={acao} className="space-y-3">
      <Campo rotulo="Código" dica="É o que a pessoa vai digitar/falar. Pode editar.">
        <div className="flex gap-1">
          <Input
            name="codigo"
            required
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase().replace(/\s/g, ""))}
            className="uppercase tracking-wider"
          />
          <button
            type="button"
            onClick={() => setCodigo(gerarCodigo())}
            title="Gerar outro"
            className="shrink-0 rounded-lg border border-line px-3 text-muted hover:bg-hover"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </Campo>
      <div className="grid grid-cols-2 gap-2">
        <Campo rotulo="Desconto (%)">
          <Input name="percentual" required inputMode="decimal" placeholder="10" />
        </Campo>
        <Campo rotulo="Limite de usos" dica="Vazio = sem limite">
          <Input name="limite_usos" inputMode="numeric" placeholder="ex.: 5" />
        </Campo>
        <Campo rotulo="Vale de">
          <Input name="valido_de" type="date" defaultValue={hoje} />
        </Campo>
        <Campo rotulo="Até">
          <Input name="valido_ate" type="date" defaultValue={maisDias(hoje, 6)} />
        </Campo>
      </div>
      <Campo rotulo="Anotação">
        <Input name="descricao" placeholder="ex.: 5 primeiros da transmissão" />
      </Campo>
      <Erro>{estado.erro}</Erro>
      <Botao disabled={enviando}>{enviando ? "Criando…" : "Criar cupom"}</Botao>
    </form>
  );
}

function Alternar({ c }: { c: Cupom }) {
  const [pendente, iniciar] = useTransition();
  return (
    <button
      type="button"
      disabled={pendente}
      onClick={() =>
        iniciar(async () => {
          await definirCupomAtivo(c.id, !c.ativo);
          toast(c.ativo ? `Cupom ${c.codigo} desativado.` : `Cupom ${c.codigo} reativado.`, {
            action: c.ativo ? { label: "Desfazer", onClick: () => definirCupomAtivo(c.id, true) } : undefined,
          });
        })
      }
      title={c.ativo ? "Desativar" : "Reativar"}
      className={cn("rounded-md p-1.5 hover:bg-hover", c.ativo ? "text-red-400/80" : "text-emerald-400")}
    >
      <Power size={15} />
    </button>
  );
}

const ORDEM: OpcaoOrdem<Cupom & { sit: string }>[] = [
  { id: "criado", rotulo: "Criado", valor: (c) => c.created_at, padrao: "desc" },
  { id: "codigo", rotulo: "Código", valor: (c) => c.codigo },
  { id: "pct", rotulo: "%", valor: (c) => c.percentual_bps, padrao: "desc" },
  { id: "usos", rotulo: "Usos", valor: (c) => c.usos, padrao: "desc" },
  { id: "validade", rotulo: "Validade", valor: (c) => c.valido_ate },
  { id: "sit", rotulo: "Situação", valor: (c) => c.sit },
];

export function ListaCupons({ cupons }: { cupons: Cupom[] }) {
  const hoje = hojeISO();
  const linhas = cupons.map((c) => ({ ...c, sit: situacaoCupom(c, hoje) }));
  const ord = useOrdenacao(linhas, ORDEM, "criado");
  if (!cupons.length)
    return <p className="rounded-xl border border-dashed border-line p-10 text-center text-sm text-muted">Nenhum cupom ainda.</p>;

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-card">
      <table className="w-full min-w-[620px] text-sm">
        <thead className="border-b border-line text-left">
          <tr>
            {ORDEM.map((o) => (
              <ThOrdem key={o.id} rotulo={o.rotulo} col={o.id} {...ord} className="px-3 py-2" />
            ))}
            <th />
          </tr>
        </thead>
        <tbody>
          {ord.ordenados.map((c) => {
            const [selo, cor] = SELO_CUPOM[c.sit];
            return (
              <tr key={c.id} className="border-b border-line/60 last:border-0">
                <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted">{formatData(c.created_at)}</td>
                <td className="px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(c.codigo).then(() => toast.success(`${c.codigo} copiado`))}
                    className="inline-flex items-center gap-1.5 font-mono font-semibold tracking-wider hover:text-accent"
                    title="Copiar"
                  >
                    {c.codigo} <Copy size={12} className="text-faint" />
                  </button>
                  {c.descricao && <div className="text-[11px] text-muted">{c.descricao}</div>}
                </td>
                <td className="px-3 py-2.5 font-semibold tabular-nums">{formatBps(c.percentual_bps)}</td>
                <td className="px-3 py-2.5 tabular-nums">
                  {c.usos}
                  {c.limite_usos ? <span className="text-faint"> / {c.limite_usos}</span> : ""}
                  {c.ultimo_uso && <div className="text-[10px] text-faint">último {formatDataHora(c.ultimo_uso)}</div>}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted">
                  {c.valido_de ? formatData(c.valido_de) : "—"} → {c.valido_ate ? formatData(c.valido_ate) : "sem fim"}
                </td>
                <td className="px-3 py-2.5">
                  <span className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-[11px]", cor)}>{selo}</span>
                </td>
                <td className="px-2 py-2.5 text-right">
                  <Alternar c={c} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
