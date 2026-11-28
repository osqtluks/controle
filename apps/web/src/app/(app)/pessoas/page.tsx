import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { Cabecalho, Carregando, Secao } from "@/components/ui/pagina";
import { hojeISO } from "@/lib/datas";
import { resumosDePessoas } from "@/modules/pessoas/dados";
import { FormPessoa } from "@/modules/pessoas/componentes/form-pessoa";
import { ListaPessoas } from "@/modules/pessoas/componentes/lista-pessoas";

export const metadata: Metadata = { title: "Pessoas" };

async function Conteudo() {
  await connection();
  const hoje = hojeISO();
  const pessoas = await resumosDePessoas(hoje);
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <ListaPessoas pessoas={pessoas} />
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <Secao titulo="Nova pessoa">
          <FormPessoa pessoas={pessoas.map((p) => ({ id: p.id, nome: p.nome }))} hoje={hoje} compacto />
        </Secao>
      </aside>
    </div>
  );
}

export default function PessoasPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <Cabecalho titulo="Pessoas" sub="Clientes e fornecedores: compras, conquistas, brindes e indicações." />
      <Suspense fallback={<Carregando linhas={4} />}>
        <Conteudo />
      </Suspense>
    </div>
  );
}
