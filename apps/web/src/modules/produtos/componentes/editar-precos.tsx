"use client";

import { useActionState, useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { formatBRL, formatBps, formatLucro, margemBps, ordenarFaixas, rotuloFaixa, type TabelaPreco } from "@ct/core";
import { Botao, Erro } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import { atualizarPrecos, type EstadoForm } from "../acoes";
import { CamposPreco } from "./campos-preco";

/** Bloco de preços na tela do produto (e no Menu), com edição rápida no lugar. */
export function EditarPrecos({
  id,
  tabela,
  custo,
  inicialAberto = false,
}: {
  id: string;
  tabela: TabelaPreco;
  custo: number | null;
  inicialAberto?: boolean;
}) {
  const [aberto, setAberto] = useState(inicialAberto);
  const [estado, acao, enviando] = useActionState<EstadoForm, FormData>(atualizarPrecos, {});

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fecha o editor depois de salvar
    if (estado.ok && !inicialAberto) setAberto(false);
  }, [estado, inicialAberto]);

  if (aberto)
    return (
      <form action={acao} className="space-y-3 rounded-lg border border-accent/40 bg-bg/60 p-3">
        <input type="hidden" name="id" value={id} />
        <CamposPreco iniciais={{ custo, faixas: tabela }} />
        <Erro>{estado.erro}</Erro>
        {estado.ok && inicialAberto && <p className="text-xs text-emerald-400">Salvo.</p>}
        <div className="flex gap-2">
          <Botao disabled={enviando}>{enviando ? "Salvando…" : "Salvar preços"}</Botao>
          {!inicialAberto && (
            <Botao type="button" variante="secundario" onClick={() => setAberto(false)}>
              Cancelar
            </Botao>
          )}
        </div>
      </form>
    );

  const faixas = ordenarFaixas(tabela);
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-lg bg-bg/60 p-3">
          <div className="text-sm font-medium text-muted">Pago/g</div>
          <div className="text-xl font-semibold tabular-nums">{custo !== null ? formatBRL(custo) : "—"}</div>
        </div>
        {faixas.map((f) => {
          const lucro = custo !== null ? f.precoCents - custo : null;
          const margem = custo !== null ? margemBps(f.precoCents, custo) : null;
          return (
            <div key={f.minDg} className="rounded-lg bg-bg/60 p-3">
              <div className="text-sm font-semibold text-fg">Vendo {rotuloFaixa(f.minDg)}</div>
              <div className="text-xl font-semibold tabular-nums">{formatBRL(f.precoCents)}</div>
              {lucro !== null && (
                <div className={cn("text-xs tabular-nums", lucro > 0 ? "text-emerald-400" : lucro < 0 ? "text-red-400" : "text-muted")}>
                  {formatLucro(lucro)}
                  {lucro < 0 ? " prejuízo" : ""}
                  {margem !== null && <span className="text-faint"> · {formatBps(margem)}</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-line py-2 text-xs text-muted hover:bg-hover hover:text-fg"
      >
        <Pencil size={13} /> Ajustar preços e faixas
      </button>
    </div>
  );
}
