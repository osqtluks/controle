"use client";

import { useTransition } from "react";
import { Archive, ArchiveRestore } from "lucide-react";
import { arquivarProduto } from "../acoes";

/** Produtos não são apagados (têm histórico de lotes); arquivar tira da lista. */
export function BotaoArquivar({ id, arquivado }: { id: string; arquivado: boolean }) {
  const [pendente, iniciar] = useTransition();
  return (
    <button
      type="button"
      disabled={pendente}
      onClick={() => {
        if (arquivado || confirm("Arquivar este produto? Ele sai da lista, mas o histórico fica guardado."))
          iniciar(() => arquivarProduto(id, !arquivado));
      }}
      className="inline-flex items-center gap-2 rounded-lg border border-line bg-card px-3 py-2.5 text-sm text-muted hover:bg-hover disabled:opacity-60"
    >
      {arquivado ? <ArchiveRestore size={15} /> : <Archive size={15} />}
      {arquivado ? "Reativar" : "Arquivar"}
    </button>
  );
}
