import type { Metadata } from "next";
import { Suspense } from "react";
import { Cabecalho, Carregando } from "@/components/ui/pagina";
import { listarProdutos } from "@/modules/produtos/dados";
import { TabelaMenu } from "@/modules/produtos/componentes/tabela-menu";

export const metadata: Metadata = { title: "Menu" };

async function Tabela() {
  return <TabelaMenu produtos={await listarProdutos()} />;
}

export default function MenuPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <Cabecalho titulo="Menu" sub="Preço por grama em cada faixa de quantidade." />
      <Suspense fallback={<Carregando linhas={1} />}>
        <Tabela />
      </Suspense>
    </div>
  );
}
