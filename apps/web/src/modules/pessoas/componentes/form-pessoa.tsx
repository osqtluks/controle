"use client";

import { useActionState } from "react";
import { Botao, Campo, Erro, Input, Select, Textarea } from "@/components/ui/form";
import { criarPessoa, type EstadoPessoa } from "../acoes";
import { TIPO_PESSOA } from "../tipos";

export function FormPessoa() {
  const [estado, acao, enviando] = useActionState<EstadoPessoa, FormData>(criarPessoa, {});
  return (
    <form action={acao} className="space-y-3">
      <Campo rotulo="Nome *">
        <Input name="nome" required maxLength={120} />
      </Campo>
      <Campo rotulo="Tipo">
        <Select name="tipo" defaultValue="cliente">
          {Object.entries(TIPO_PESSOA).map(([v, r]) => (
            <option key={v} value={v}>
              {r}
            </option>
          ))}
        </Select>
      </Campo>
      <Campo rotulo="Telefone / WhatsApp">
        <Input name="telefone" type="tel" inputMode="tel" />
      </Campo>
      <Campo rotulo="Observações">
        <Textarea name="observacoes" rows={2} />
      </Campo>
      <Erro>{estado.erro}</Erro>
      {estado.ok && <p className="text-sm text-emerald-400">Salvo.</p>}
      <Botao disabled={enviando}>{enviando ? "Salvando…" : "Adicionar"}</Botao>
    </form>
  );
}
