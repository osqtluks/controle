import type { Metadata } from "next";
import { Suspense } from "react";
import { Cabecalho, Carregando, Secao } from "@/components/ui/pagina";
import { listarPessoas } from "@/modules/pessoas/dados";
import { FormPessoa } from "@/modules/pessoas/componentes/form-pessoa";
import { ListaPessoas } from "@/modules/pessoas/componentes/lista-pessoas";

export const metadata: Metadata = { title: "Pessoas" };

async function Lista() {
  return <ListaPessoas pessoas={await listarPessoas()} />;
}

export default function PessoasPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <Cabecalho titulo="Pessoas" sub="Clientes e fornecedores. Rankings e histórico chegam na fase 2." />
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Suspense fallback={<Carregando linhas={2} />}>
          <Lista />
        </Suspense>
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <Secao titulo="Nova pessoa">
            <FormPessoa />
          </Secao>
        </aside>
      </div>
    </div>
  );
}
