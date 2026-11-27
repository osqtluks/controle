"use client";

import { useActionState, useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { FAIXAS, formatBRL, formatBps, formatLucro, margemBps, precosEfetivos, type TabelaPreco } from "@ct/core";
import { Botao, Erro } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import { atualizarPrecos, type EstadoForm } from "../acoes";
import { CamposPreco } from "./campos-preco";

/** Bloco de preços na tela do produto, com edição rápida no lugar. */
export function EditarPrecos({ id, tabela, custo }: { id: string; tabela: TabelaPreco; custo: number | null }) {
  const [aberto, setAberto] = useState(false);
  const [estado, acao, enviando] = useActionState<EstadoForm, FormData>(atualizarPrecos, {});

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fecha o editor depois de salvar
    if (estado.ok) setAberto(false);
  }, [estado]);

  if (aberto)
    return (
      <form action={acao} className="space-y-3 rounded-lg border border-accent/40 bg-bg/60 p-3">
        <input type="hidden" name="id" value={id} />
        <CamposPreco iniciais={{ custo, base: tabela.base, de10: tabela.de10, de30: tabela.de30 }} />
        <Erro>{estado.erro}</Erro>
        <div className="flex gap-2">
          <Botao disabled={enviando}>{enviando ? "Salvando…" : "Salvar preços"}</Botao>
          <Botao type="button" variante="secundario" onClick={() => setAberto(false)}>
            Cancelar
          </Botao>
        </div>
      </form>
    );

  const ef = precosEfetivos(tabela);
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-2">
        <div className="rounded-lg bg-bg/60 p-3">
          <div className="text-[11px] text-faint">Pago/g</div>
          <div className="text-base font-semibold tabular-nums">{custo !== null ? formatBRL(custo) : "—"}</div>
        </div>
        {FAIXAS.map((f) => {
          const v = ef[f.id];
          const lucro = custo !== null ? v - custo : null;
          const margem = custo !== null ? margemBps(v, custo) : null;
          return (
            <div key={f.id} className="rounded-lg bg-bg/60 p-3">
              <div className="text-[11px] text-faint">Vendo {f.rotulo}</div>
              <div className="text-base font-semibold tabular-nums">{formatBRL(v)}</div>
              {lucro !== null && (
                <div className={cn("text-[11px] tabular-nums", (lucro > 0 ? "text-emerald-400" : lucro < 0 ? "text-red-400" : "text-muted"))}>
                  {formatLucro(lucro)}{lucro < 0 ? " prejuízo" : ""}
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
        <Pencil size={13} /> Ajustar preços
      </button>
    </div>
  );
}
