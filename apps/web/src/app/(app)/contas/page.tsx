import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { Cabecalho, Carregando, linkBotao } from "@/components/ui/pagina";
import { listarContas } from "@/modules/contas/dados";
import { ListaContas } from "@/modules/contas/componentes/lista-contas";

export const metadata: Metadata = { title: "Contas" };

async function Lista() {
  return <ListaContas contas={await listarContas()} />;
}

export default function ContasPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <Cabecalho
        titulo="Contas"
        sub="O que te devem e o que você deve. Fiado e compras a prazo entram sozinhos."
        acoes={
          <Link href="/contas/nova" className={linkBotao}>
            <Plus size={16} /> Nova conta
          </Link>
        }
      />
      <Suspense fallback={<Carregando linhas={2} />}>
        <Lista />
      </Suspense>
    </div>
  );
}
