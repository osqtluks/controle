"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { custoPorGrama, formatBRL, parseBRL, parseGrams, priceFor } from "@ct/core";
import { centsParaTexto } from "./campos-preco";
import { Botao, Campo, Erro, Input, Textarea } from "@/components/ui/form";
import { SeletorFornecedor } from "@/modules/pessoas/componentes/seletor-fornecedor";
import { cn } from "@/lib/cn";
import { hojeISO } from "@/lib/datas";
import type { Pessoa } from "@/modules/pessoas/tipos";
import { darEntrada, type EstadoForm } from "../acoes";

export function FormEntrada({
  produtoId,
  fornecedores,
  custoRef,
  fornecedorPadrao,
}: {
  produtoId: string;
  fornecedores: Pessoa[];
  custoRef: number | null;
  fornecedorPadrao: string | null;
}) {
  const [estado, acao, enviando] = useActionState<EstadoForm, FormData>(darEntrada, {});
  const [pagamento, setPagamento] = useState<"avista" | "prazo">("avista");
  const [qtd, setQtd] = useState("");
  const [custo, setCusto] = useState("");
  // Preço por grama e total andam juntos: editar um recalcula o outro.
  const [porG, setPorG] = useState(centsParaTexto(custoRef));
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado.ok) {
      form.current?.reset();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- limpar o formulário após salvar
      setQtd("");
      setCusto("");
      setPorG(centsParaTexto(custoRef));
      setPagamento("avista");
    }
  }, [estado, custoRef]);

  const dg = parseGrams(qtd);

  function mudarQtd(v: string) {
    setQtd(v);
    const d = parseGrams(v);
    const pg = parseBRL(porG);
    if (d && pg !== null) setCusto(centsParaTexto(priceFor(d, pg)));
  }
  function mudarPorG(v: string) {
    setPorG(v);
    const pg = parseBRL(v);
    if (dg && pg !== null) setCusto(centsParaTexto(priceFor(dg, pg)));
  }
  function mudarTotal(v: string) {
    setCusto(v);
    const t = parseBRL(v);
    const pg = dg && t !== null ? custoPorGrama(t, dg) : null;
    if (pg !== null) setPorG(centsParaTexto(pg));
  }

  return (
    <form ref={form} action={acao} className="space-y-3">
      <input type="hidden" name="produto_id" value={produtoId} />
      <input type="hidden" name="pagamento" value={pagamento} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Veio de (fornecedor)">
          <SeletorFornecedor key={estado.ok ? "ok" : "x"} name="fornecedor_id" fornecedores={fornecedores} valor={fornecedorPadrao} />
        </Campo>
        <Campo rotulo="Data da compra">
          <Input name="data_compra" type="date" defaultValue={hojeISO()} />
        </Campo>
        <Campo rotulo="Quantidade (g) *" dica="Ex.: 25 ou 3,5" className="sm:col-span-2">
          <Input name="quantidade" required inputMode="decimal" value={qtd} onChange={(e) => mudarQtd(e.target.value)} />
        </Campo>
        <Campo rotulo="Paguei por grama (R$)" dica={custoRef !== null ? `Último: ${formatBRL(custoRef)}` : "Ex.: 9,80"}>
          <Input inputMode="decimal" value={porG} onChange={(e) => mudarPorG(e.target.value)} />
        </Campo>
        <Campo rotulo="Total pago (R$) *" dica="Calcula sozinho; pode ajustar">
          <Input name="custo_total" required inputMode="decimal" value={custo} onChange={(e) => mudarTotal(e.target.value)} />
        </Campo>
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-lg border border-line bg-bg p-1 text-sm">
        {(["avista", "prazo"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setPagamento(v)}
            className={cn("rounded-md py-2", pagamento === v ? "bg-hover font-medium text-fg" : "text-muted")}
          >
            {v === "avista" ? "Paguei à vista" : "Peguei a prazo"}
          </button>
        ))}
      </div>
      {pagamento === "prazo" && (
        <Campo rotulo="Vence em *" dica="Vira conta a pagar com aviso de atraso (completo na fase de Contas).">
          <Input name="vencimento" type="date" required min={hojeISO()} />
        </Campo>
      )}

      <Campo rotulo="Observações">
        <Textarea name="observacoes" rows={2} />
      </Campo>

      <Erro>{estado.erro}</Erro>
      {estado.ok && <p className="text-sm text-emerald-400">Entrada registrada.</p>}
      <Botao disabled={enviando}>{enviando ? "Registrando…" : "Registrar entrada"}</Botao>
    </form>
  );
}
