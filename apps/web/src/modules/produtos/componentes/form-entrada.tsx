"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { custoPorGrama, formatBRL, parseBRL, parseGrams } from "@ct/core";
import { Botao, Campo, Erro, Input, Select, Textarea } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import { hojeISO } from "@/lib/datas";
import type { Pessoa } from "@/modules/pessoas/tipos";
import { darEntrada, type EstadoForm } from "../acoes";

export function FormEntrada({ produtoId, fornecedores }: { produtoId: string; fornecedores: Pessoa[] }) {
  const [estado, acao, enviando] = useActionState<EstadoForm, FormData>(darEntrada, {});
  const [pagamento, setPagamento] = useState<"avista" | "prazo">("avista");
  const [qtd, setQtd] = useState("");
  const [custo, setCusto] = useState("");
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado.ok) {
      form.current?.reset();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- limpar o formulário após salvar
      setQtd("");
      setCusto("");
      setPagamento("avista");
    }
  }, [estado]);

  const dg = parseGrams(qtd);
  const cents = parseBRL(custo);
  const porGrama = dg && cents !== null ? custoPorGrama(cents, dg) : null;

  return (
    <form ref={form} action={acao} className="space-y-3">
      <input type="hidden" name="produto_id" value={produtoId} />
      <input type="hidden" name="pagamento" value={pagamento} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Veio de (fornecedor)">
          <Select name="fornecedor_id" defaultValue="">
            <option value="">— sem fornecedor —</option>
            {fornecedores.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </Select>
          {fornecedores.length === 0 && (
            <Link href="/pessoas" className="text-[11px] text-accent">
              Cadastrar fornecedor
            </Link>
          )}
        </Campo>
        <Campo rotulo="Data da compra">
          <Input name="data_compra" type="date" defaultValue={hojeISO()} />
        </Campo>
        <Campo rotulo="Quantidade (g) *" dica="Ex.: 25 ou 3,5">
          <Input name="quantidade" required inputMode="decimal" value={qtd} onChange={(e) => setQtd(e.target.value)} />
        </Campo>
        <Campo rotulo="Valor total pago (R$) *" dica={porGrama !== null ? `= ${formatBRL(porGrama)} por grama` : "Ex.: 350,00"}>
          <Input name="custo_total" required inputMode="decimal" value={custo} onChange={(e) => setCusto(e.target.value)} />
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
