import type { Metadata } from "next";
import { Suspense } from "react";
import { Cabecalho, Carregando } from "@/components/ui/pagina";
import { listarExclusoes } from "@/modules/exclusoes/dados";
import { ListaExclusoes } from "@/modules/exclusoes/componentes/lista-exclusoes";

export const metadata: Metadata = { title: "Histórico de exclusões" };

async function Lista() {
  return <ListaExclusoes exclusoes={await listarExclusoes()} />;
}

export default function ExclusoesPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <Cabecalho
        titulo="Histórico de exclusões"
        sub="Tudo que foi excluído, com data e hora. Qualquer exclusão pode voltar ao estado anterior."
      />
      <Suspense fallback={<Carregando linhas={1} />}>
        <Lista />
      </Suspense>
    </div>
  );
}
