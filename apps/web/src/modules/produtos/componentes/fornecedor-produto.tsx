"use client";

import { useState, useTransition } from "react";
import { Check, Truck } from "lucide-react";
import { SeletorFornecedor, type OpcaoFornecedor } from "@/modules/pessoas/componentes/seletor-fornecedor";
import { definirFornecedorLote, definirFornecedorProduto } from "../acoes";

/** Hook de "salvar na hora" com aviso rápido de salvo/erro. */
function useSalvar(fn: (id: string | null) => Promise<void>) {
  const [pendente, iniciar] = useTransition();
  const [status, setStatus] = useState<"ok" | string | null>(null);
  function salvar(id: string | null) {
    setStatus(null);
    iniciar(async () => {
      try {
        await fn(id);
        setStatus("ok");
      } catch (e) {
        setStatus((e as Error).message);
      }
    });
  }
  return { pendente, status, salvar };
}

/** Fornecedor principal do produto: troca na hora, sem mexer no estoque. */
export function FornecedorProduto({
  produtoId,
  valor,
  fornecedores,
}: {
  produtoId: string;
  valor: string | null;
  fornecedores: OpcaoFornecedor[];
}) {
  const { pendente, status, salvar } = useSalvar((id) => definirFornecedorProduto(produtoId, id));
  return (
    <div className="flex items-start gap-2">
      <Truck size={16} className="mt-2.5 shrink-0 text-faint" />
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-2 text-[11px] text-faint">
          Fornecedor
          {pendente && <span>salvando…</span>}
          {status === "ok" && !pendente && (
            <span className="inline-flex items-center gap-0.5 text-emerald-400">
              <Check size={11} /> salvo
            </span>
          )}
        </div>
        <SeletorFornecedor compacto fornecedores={fornecedores} valor={valor} aoMudar={salvar} desabilitado={pendente} />
        {status && status !== "ok" && <p className="text-[11px] text-red-400">{status}</p>}
      </div>
    </div>
  );
}

/** Fornecedor de uma entrada já feita (célula da tabela de entradas). */
export function FornecedorLote({
  loteId,
  valor,
  fornecedores,
}: {
  loteId: string;
  valor: string | null;
  fornecedores: OpcaoFornecedor[];
}) {
  const { pendente, status, salvar } = useSalvar((id) => definirFornecedorLote(loteId, id));
  return (
    <div className="min-w-36">
      <SeletorFornecedor compacto fornecedores={fornecedores} valor={valor} aoMudar={salvar} desabilitado={pendente} />
      {status && status !== "ok" && <p className="text-[11px] text-red-400">{status}</p>}
    </div>
  );
}
