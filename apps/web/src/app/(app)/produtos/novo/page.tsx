import type { Metadata } from "next";
import { Suspense } from "react";
import { Cabecalho } from "@/components/ui/pagina";
import { listarCategorias } from "@/modules/produtos/dados";
import { listarPessoas } from "@/modules/pessoas/dados";
import { FormProduto } from "@/modules/produtos/componentes/form-produto";

export const metadata: Metadata = { title: "Novo produto" };

async function Form() {
  const [categorias, fornecedores] = await Promise.all([listarCategorias(), listarPessoas("fornecedores")]);
  return <FormProduto categorias={categorias} fornecedores={fornecedores} />;
}

export default function NovoProduto() {
  return (
    <div className="mx-auto max-w-3xl">
      <Cabecalho titulo="Novo produto" voltar="/produtos" />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl border border-line bg-card" />}>
        <Form />
      </Suspense>
    </div>
  );
}
