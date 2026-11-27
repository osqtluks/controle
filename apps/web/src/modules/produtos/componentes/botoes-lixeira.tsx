"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/cn";
import { excluirDeVez, moverParaLixeira, restaurarExclusao } from "../acoes";

/** Aviso de exclusão com botão "Desfazer" (fica 10 s na tela). */
function avisarComDesfazer(mensagem: string, desfazer: () => Promise<void>) {
  toast(mensagem, {
    duration: 10_000,
    action: {
      label: "Desfazer",
      onClick: () =>
        toast.promise(desfazer(), {
          loading: "Desfazendo…",
          success: "Pronto, voltou como estava.",
          error: (e: Error) => e.message,
        }),
    },
  });
}

async function mandarParaLixeira(id: string, nome: string) {
  await moverParaLixeira(id, true);
  avisarComDesfazer(`"${nome}" foi para a Lixeira.`, () => moverParaLixeira(id, false));
}

/** Lixeirinha vermelha no canto do card da lista. Não abre o produto ao tocar. */
export function BotaoLixeiraCard({ id, nome }: { id: string; nome: string }) {
  const [pendente, iniciar] = useTransition();
  return (
    <button
      type="button"
      aria-label={`Excluir ${nome}`}
      title="Excluir (vai para a Lixeira)"
      disabled={pendente}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (confirm(`Excluir "${nome}"?\n\nEle vai para a Lixeira e dá para desfazer.`))
          iniciar(() => mandarParaLixeira(id, nome));
      }}
      className="rounded-md p-1.5 text-red-400/70 transition-colors hover:bg-red-500/15 hover:text-red-400 disabled:opacity-50"
    >
      <Trash2 size={16} />
    </button>
  );
}

/** Botão "Excluir produto" na tela de edição. */
export function BotaoExcluirEdicao({ id, nome }: { id: string; nome: string }) {
  const [pendente, iniciar] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={pendente}
      onClick={() => {
        if (!confirm(`Excluir "${nome}"?\n\nEle vai para a Lixeira e dá para desfazer.`)) return;
        iniciar(async () => {
          await mandarParaLixeira(id, nome);
          router.push("/produtos");
        });
      }}
      className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 px-4 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-500/10 disabled:opacity-60"
    >
      <Trash2 size={16} /> {pendente ? "Excluindo…" : "Excluir produto"}
    </button>
  );
}

/** Restaurar ou excluir de vez (itens que estão na Lixeira). */
export function AcoesLixeira({ id, nome, voltarPara }: { id: string; nome: string; voltarPara?: string }) {
  const [pendente, iniciar] = useTransition();
  const router = useRouter();
  const btn = "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-60";
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={pendente}
        onClick={(e) => {
          e.preventDefault();
          iniciar(async () => {
            await moverParaLixeira(id, false);
            toast.success(`"${nome}" foi restaurado.`);
          });
        }}
        className={cn(btn, "border border-line bg-card text-fg hover:bg-hover")}
      >
        <RotateCcw size={14} /> Restaurar
      </button>
      <button
        type="button"
        disabled={pendente}
        onClick={(e) => {
          e.preventDefault();
          if (
            !confirm(
              `Excluir "${nome}" de vez?\n\nSome o produto, as entradas, a foto e o histórico.\nUma cópia fica no Histórico de exclusões para você poder voltar.`,
            )
          )
            return;
          iniciar(async () => {
            const exclusao = await excluirDeVez(id);
            avisarComDesfazer(`"${nome}" foi excluído de vez.`, () => restaurarExclusao(exclusao));
            if (voltarPara) router.push(voltarPara);
          });
        }}
        className={cn(btn, "bg-red-600 text-white hover:bg-red-500")}
      >
        <Trash2 size={14} /> Excluir de vez
      </button>
    </div>
  );
}
