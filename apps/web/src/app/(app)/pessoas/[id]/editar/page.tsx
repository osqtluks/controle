import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Cabecalho, Carregando } from "@/components/ui/pagina";
import { hojeISO } from "@/lib/datas";
import { listarPessoas, obterPessoa } from "@/modules/pessoas/dados";
import { FormPessoa } from "@/modules/pessoas/componentes/form-pessoa";

export const metadata: Metadata = { title: "Editar pessoa" };

async function Form({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connection();
  const [p, pessoas] = await Promise.all([obterPessoa(id), listarPessoas()]);
  if (!p) notFound();
  return (
    <>
      <Cabecalho titulo={`Editar ${p.nome}`} voltar={`/pessoas/${p.id}`} />
      <div className="rounded-xl border border-line bg-card p-4">
        <FormPessoa pessoa={p} pessoas={pessoas.map((x) => ({ id: x.id, nome: x.nome }))} hoje={hojeISO()} />
      </div>
    </>
  );
}

export default function EditarPessoaPage({ params }: PageProps<"/pessoas/[id]/editar">) {
  return (
    <div className="mx-auto max-w-2xl">
      <Suspense fallback={<Carregando linhas={1} />}>
        <Form params={params} />
      </Suspense>
    </div>
  );
}
