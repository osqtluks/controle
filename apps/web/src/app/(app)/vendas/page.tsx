import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { Cabecalho, Carregando, linkBotao } from "@/components/ui/pagina";
import { listarVendas } from "@/modules/vendas/dados";
import { ListaVendas } from "@/modules/vendas/componentes/lista-vendas";

export const metadata: Metadata = { title: "Vendas" };

async function Lista() {
  return <ListaVendas vendas={await listarVendas()} />;
}

export default function VendasPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <Cabecalho
        titulo="Vendas"
        sub="Faturamento e lucro real de cada venda."
        acoes={
          <Link href="/vendas/nova" className={linkBotao}>
            <Plus size={16} /> Nova venda
          </Link>
        }
      />
      <Suspense fallback={<Carregando linhas={1} />}>
        <Lista />
      </Suspense>
    </div>
  );
}
