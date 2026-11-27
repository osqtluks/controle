"use client";

import { useTransition } from "react";
import { RotateCcw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { restaurarExclusao } from "@/modules/produtos/acoes";
import { cancelarVenda, reativarVenda } from "../acoes";

export function BotaoCancelarVenda({ id, numero }: { id: string; numero: number }) {
  const [pendente, iniciar] = useTransition();
  return (
    <button
      type="button"
      disabled={pendente}
      onClick={() => {
        if (!confirm(`Cancelar a venda #${numero}?\n\nAs gramas voltam para o estoque. Dá para desfazer.`)) return;
        iniciar(async () => {
          try {
            const exclusao = await cancelarVenda(id);
            toast(`Venda #${numero} cancelada.`, {
              duration: 10_000,
              action: {
                label: "Desfazer",
                onClick: () =>
                  toast.promise(restaurarExclusao(exclusao), {
                    loading: "Desfazendo…",
                    success: "Venda reativada.",
                    error: (e: Error) => e.message,
                  }),
              },
            });
          } catch (e) {
            toast.error((e as Error).message);
          }
        });
      }}
      className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 px-3 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-500/10 disabled:opacity-60"
    >
      <XCircle size={16} /> Cancelar venda
    </button>
  );
}

export function BotaoReativarVenda({ id }: { id: string }) {
  const [pendente, iniciar] = useTransition();
  return (
    <button
      type="button"
      disabled={pendente}
      onClick={() =>
        iniciar(async () => {
          try {
            await reativarVenda(id);
            toast.success("Venda reativada.");
          } catch (e) {
            toast.error((e as Error).message);
          }
        })
      }
      className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-black disabled:opacity-60"
    >
      <RotateCcw size={15} /> Reativar venda
    </button>
  );
}
