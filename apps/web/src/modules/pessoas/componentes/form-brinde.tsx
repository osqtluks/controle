"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Gift } from "lucide-react";
import { toast } from "sonner";
import { formatGrams } from "@ct/core";
import { Botao, Campo, Erro, Input, Select } from "@/components/ui/form";
import { registrarBrinde } from "@/modules/vendas/acoes";

/** Dar brinde: baixa no estoque para este cliente, sem faturamento nem lucro. */
export function FormBrinde({
  clienteId,
  produtos,
  sugestao,
}: {
  clienteId: string;
  produtos: { id: string; nome: string; estoque_dg: number }[];
  /** Texto pronto para a observação (ex.: "brinde da 4ª compra de novembro"). */
  sugestao?: string;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [produto, setProduto] = useState("");
  const [qtd, setQtd] = useState("1");
  const [obs, setObs] = useState(sugestao ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  if (!aberto)
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/40 px-3 py-2 text-sm text-amber-300 hover:bg-amber-400/10"
      >
        <Gift size={15} /> Dar brinde
      </button>
    );

  function dar() {
    setErro(null);
    iniciar(async () => {
      const r = await registrarBrinde({ cliente_id: clienteId, observacoes: obs, itens: [{ produto_id: produto, quantidade: qtd }] });
      if ("erro" in r) return setErro(r.erro);
      toast.success("Brinde registrado. Saiu do estoque sem entrar no lucro.", {
        action: { label: "Ver", onClick: () => router.push(`/vendas/${r.id}`) },
      });
      setAberto(false);
      setProduto("");
    });
  }

  return (
    <div className="space-y-2 rounded-lg border border-amber-400/30 bg-amber-400/5 p-3">
      <div className="text-sm font-medium text-amber-200">Dar brinde</div>
      <div className="grid gap-2 sm:grid-cols-[1fr_110px]">
        <Campo rotulo="Produto">
          <Select value={produto} onChange={(e) => setProduto(e.target.value)}>
            <option value="">Escolha…</option>
            {produtos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome} ({formatGrams(p.estoque_dg)})
              </option>
            ))}
          </Select>
        </Campo>
        <Campo rotulo="Gramas">
          <Input inputMode="decimal" value={qtd} onChange={(e) => setQtd(e.target.value)} />
        </Campo>
      </div>
      <Campo rotulo="Observação (opcional)">
        <Input value={obs} maxLength={200} onChange={(e) => setObs(e.target.value)} placeholder="ex.: brinde da 4ª compra" />
      </Campo>
      <p className="text-[11px] text-faint">
        Sai do estoque (lotes mais antigos) e fica no histórico do cliente. Não conta como venda, faturamento nem lucro. Dá
        para cancelar depois, igual a uma venda.
      </p>
      <Erro>{erro}</Erro>
      <div className="flex gap-2">
        <Botao type="button" onClick={dar} disabled={pendente || !produto}>
          {pendente ? "Registrando…" : "Registrar brinde"}
        </Botao>
        <Botao type="button" variante="secundario" onClick={() => setAberto(false)}>
          Cancelar
        </Botao>
      </div>
    </div>
  );
}
