import type { Metadata } from "next";
import { Suspense } from "react";
import { Cabecalho } from "@/components/ui/pagina";
import { listarPessoas } from "@/modules/pessoas/dados";
import { FormConta } from "@/modules/contas/componentes/form-conta";

export const metadata: Metadata = { title: "Nova conta" };

async function Form() {
  return <FormConta pessoas={await listarPessoas()} />;
}

export default function NovaContaPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <Cabecalho titulo="Nova conta" voltar="/contas" />
      <Suspense fallback={<div className="h-72 animate-pulse rounded-xl border border-line bg-card" />}>
        <Form />
      </Suspense>
    </div>
  );
}
