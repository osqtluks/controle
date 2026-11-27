import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Cabecalho } from "@/components/ui/pagina";
import { listarCategorias, obterProduto } from "@/modules/produtos/dados";
import { listarPessoas } from "@/modules/pessoas/dados";
import { FormProduto } from "@/modules/produtos/componentes/form-produto";

export const metadata: Metadata = { title: "Editar produto" };

async function Form({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [produto, categorias, fornecedores] = await Promise.all([
    obterProduto(id),
    listarCategorias(),
    listarPessoas("fornecedores"),
  ]);
  if (!produto) notFound();
  return (
    <>
      <Cabecalho titulo={`Editar ${produto.nome}`} voltar={`/produtos/${id}`} />
      <FormProduto produto={produto} categorias={categorias} fornecedores={fornecedores} />
    </>
  );
}

export default function EditarProduto({ params }: PageProps<"/produtos/[id]/editar">) {
  return (
    <div className="mx-auto max-w-3xl">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl border border-line bg-card" />}>
        <Form params={params} />
      </Suspense>
    </div>
  );
}
